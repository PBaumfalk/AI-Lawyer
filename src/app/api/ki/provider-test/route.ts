import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { testProviderConnection } from "@/lib/ai/provider";
import type { UserRole } from "@prisma/client";

/**
 * POST /api/ki/provider-test
 *
 * Test AI provider connection with provided (unsaved) config.
 * Admin only.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const role = (session.user as any).role as UserRole;
  if (role !== "ADMIN") {
    return NextResponse.json(
      { error: "Nur Administratoren koennen Provider testen" },
      { status: 403 }
    );
  }

  let body: {
    provider?: string;
    apiKey?: string;
    model?: string;
    ollamaUrl?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltige Anfrage" },
      { status: 400 }
    );
  }

  const result = await testProviderConnection({
    provider: body.provider || "ollama",
    apiKey: body.apiKey,
    model: body.model,
    ollamaUrl: body.ollamaUrl,
  });

  return NextResponse.json(result);
}
