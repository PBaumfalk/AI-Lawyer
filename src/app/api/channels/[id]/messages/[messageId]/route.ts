import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/rbac";
import { editMessage, softDeleteMessage } from "@/lib/messaging/message-service";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const editMessageSchema = z.object({
  body: z.string().min(1).max(10000).trim(),
});

// ---------------------------------------------------------------------------
// PATCH /api/channels/{id}/messages/{messageId} -- Edit message
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { messageId } = await params;

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 },
    );
  }

  const parsed = editMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await editMessage(messageId, parsed.data.body, session.user.id);

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json({ message: result.message });
}

// ---------------------------------------------------------------------------
// DELETE /api/channels/{id}/messages/{messageId} -- Soft-delete message
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { messageId } = await params;

  const result = await softDeleteMessage(
    messageId,
    session.user.id,
    session.user.role,
  );

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json({ success: true });
}
