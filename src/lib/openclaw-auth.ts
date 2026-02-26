import { NextRequest } from "next/server";

/**
 * Validate OpenClaw gateway token from Authorization header.
 * Returns true if the token matches OPENCLAW_GATEWAY_TOKEN env var.
 *
 * OpenClaw API endpoints use token-based auth (not NextAuth sessions)
 * to allow the AI agent gateway to call scoped endpoints.
 *
 * Scope: read ai:-tagged tasks, write drafts/notes, update task status.
 * Denied: document approval, sending, user management, deletion.
 */
export function validateOpenClawToken(req: NextRequest): boolean {
  const expectedToken = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (!expectedToken) return false;

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  // Constant-time comparison to prevent timing attacks
  if (token.length !== expectedToken.length) return false;

  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Helper to return a 401 response for invalid OpenClaw tokens.
 */
export function unauthorizedResponse() {
  return Response.json(
    { error: "Ungültiger oder fehlender OpenClaw-Token" },
    { status: 401 }
  );
}
