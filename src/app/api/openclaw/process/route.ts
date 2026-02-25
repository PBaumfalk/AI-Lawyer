import { NextRequest } from "next/server";
import {
  validateOpenClawToken,
  unauthorizedResponse,
} from "@/lib/openclaw-auth";
import { auth } from "@/lib/auth";
import { processTaggedTasks } from "@/lib/ai/process-tasks";
import { isProviderAvailable } from "@/lib/ai/provider";
import type { UserRole } from "@prisma/client";

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (sliding window)
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max 10 requests per minute per user

const requestLog = new Map<string, number[]>();

function checkRateLimit(userId: string): {
  ok: boolean;
  retryAfter?: number;
} {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  // Get or create request log for this user
  let timestamps = requestLog.get(userId) || [];

  // Remove expired entries
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    const oldestInWindow = timestamps[0];
    const retryAfter = Math.ceil(
      (oldestInWindow + RATE_LIMIT_WINDOW_MS - now) / 1000
    );
    requestLog.set(userId, timestamps);
    return { ok: false, retryAfter };
  }

  timestamps.push(now);
  requestLog.set(userId, timestamps);
  return { ok: true };
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS * 2;
  const entries = Array.from(requestLog.entries());
  for (const [key, timestamps] of entries) {
    const valid = timestamps.filter((t: number) => t > cutoff);
    if (valid.length === 0) {
      requestLog.delete(key);
    } else {
      requestLog.set(key, valid);
    }
  }
}, 5 * 60 * 1000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Authenticate via NextAuth session or OpenClaw gateway token.
 * Returns { authenticated, userId, role, isGateway } or null.
 */
async function authenticateRequest(req: NextRequest): Promise<{
  userId: string;
  role: UserRole | "GATEWAY";
} | null> {
  // Try NextAuth session first
  const session = await auth();
  if (session?.user) {
    return {
      userId: session.user.id,
      role: (session.user as any).role as UserRole,
    };
  }

  // Fall back to OpenClaw gateway token (backward compatibility)
  if (validateOpenClawToken(req)) {
    return { userId: "openclaw-gateway", role: "GATEWAY" };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/openclaw/process
 *
 * Trigger processing of ai:-tagged tasks.
 * Restricted to ADMIN role (session) or OpenClaw gateway token.
 * Rate-limited: max 10 requests per minute per user.
 */
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (!authResult) return unauthorizedResponse();

  // RBAC: Only ADMIN or GATEWAY can trigger processing
  if (authResult.role !== "ADMIN" && authResult.role !== "GATEWAY") {
    return Response.json(
      { error: "Nur Administratoren koennen KI-Verarbeitung ausloesen" },
      { status: 403 }
    );
  }

  // Rate limiting
  const rateCheck = checkRateLimit(authResult.userId);
  if (!rateCheck.ok) {
    return new Response(
      JSON.stringify({
        error: "Zu viele Anfragen. Bitte warten Sie.",
        retryAfter: rateCheck.retryAfter,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rateCheck.retryAfter ?? 60),
        },
      }
    );
  }

  // Check provider availability
  const available = await isProviderAvailable();
  if (!available) {
    return Response.json(
      {
        error: "KI-Provider nicht erreichbar",
        details: "Helena ist gerade nicht verfuegbar",
      },
      { status: 503 }
    );
  }

  const results = await processTaggedTasks();

  const summary = {
    processed: results.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };

  return Response.json(summary);
}

/**
 * GET /api/openclaw/process
 *
 * Health check / status endpoint.
 * Returns provider availability and pending task count.
 */
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (!authResult) return unauthorizedResponse();

  // RBAC: Only ADMIN or GATEWAY
  if (authResult.role !== "ADMIN" && authResult.role !== "GATEWAY") {
    return Response.json(
      { error: "Zugriff verweigert" },
      { status: 403 }
    );
  }

  const { prisma } = await import("@/lib/db");

  const [available, pendingCount] = await Promise.all([
    isProviderAvailable(),
    prisma.ticket.count({
      where: {
        status: { in: ["OFFEN", "IN_BEARBEITUNG"] },
      },
    }),
  ]);

  // Count only ai:-tagged tasks (need to query and filter)
  const pendingTickets = await prisma.ticket.findMany({
    where: {
      status: { in: ["OFFEN", "IN_BEARBEITUNG"] },
    },
    select: { tags: true },
  });

  const aiPendingCount = pendingTickets.filter((t) =>
    t.tags.some((tag) => tag.startsWith("ai:"))
  ).length;

  return Response.json({
    providerAvailable: available,
    pendingAiTasks: aiPendingCount,
    totalPendingTasks: pendingCount,
  });
}
