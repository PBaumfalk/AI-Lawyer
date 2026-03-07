import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { encryptCalDavCredential, decryptCalDavCredential } from "@/lib/caldav/crypto";
import { createCalDavClient, fetchCalendars } from "@/lib/caldav/client";
import type { CalDavProvider } from "@/lib/caldav/types";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  selectedCalendarUrl: z.string().optional(),
  aktiv: z.boolean().optional(),
  passwort: z.string().optional(),
  oauthTokens: z
    .object({
      accessToken: z.string(),
      refreshToken: z.string(),
      expiresAt: z.string(),
    })
    .optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/caldav-konten/[id]
 * Get a single CalDAV account detail with available calendars.
 */
export async function GET(
  _req: NextRequest,
  context: RouteParams
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await context.params;

  const konto = await (prisma as any).calDavKonto.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      provider: true,
      name: true,
      serverUrl: true,
      benutzername: true,
      authTyp: true,
      selectedCalendarUrl: true,
      aktiv: true,
      syncStatus: true,
      letzterSync: true,
      ctag: true,
      fehlerLog: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!konto) {
    return Response.json({ error: "CalDAV-Konto nicht gefunden" }, { status: 404 });
  }

  // Try to fetch available calendars
  let calendars = null;
  try {
    const fullKonto = await (prisma as any).calDavKonto.findUnique({
      where: { id },
    });

    const client = await createCalDavClient(
      fullKonto.provider as CalDavProvider,
      fullKonto.serverUrl,
      {
        username: fullKonto.benutzername,
        password: fullKonto.passwortEnc
          ? decryptCalDavCredential(fullKonto.passwortEnc)
          : undefined,
        oauthTokens: fullKonto.oauthTokens
          ? { accessToken: (fullKonto.oauthTokens as any).accessToken }
          : undefined,
      }
    );

    calendars = await fetchCalendars(client);
  } catch {
    // Calendar fetch is best-effort; don't fail the whole request
    calendars = null;
  }

  return Response.json({ konto, calendars });
}

/**
 * PATCH /api/caldav-konten/[id]
 * Update CalDAV account fields. Re-validates connection if credentials change.
 */
export async function PATCH(
  req: NextRequest,
  context: RouteParams
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await context.params;

  // Verify ownership
  const existing = await (prisma as any).calDavKonto.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return Response.json({ error: "CalDAV-Konto nicht gefunden" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Ungueltige Eingabe", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Build update object
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.selectedCalendarUrl !== undefined)
    updateData.selectedCalendarUrl = data.selectedCalendarUrl;
  if (data.aktiv !== undefined) updateData.aktiv = data.aktiv;

  // If credentials change, re-validate connection
  const credentialsChanged = data.passwort !== undefined || data.oauthTokens !== undefined;

  if (credentialsChanged) {
    const password = data.passwort ?? (existing.passwortEnc
      ? decryptCalDavCredential(existing.passwortEnc)
      : undefined);

    const oauthAccessToken = data.oauthTokens
      ? data.oauthTokens.accessToken
      : existing.oauthTokens
        ? (existing.oauthTokens as any).accessToken
        : undefined;

    try {
      const client = await createCalDavClient(
        existing.provider as CalDavProvider,
        existing.serverUrl,
        {
          username: existing.benutzername,
          password,
          oauthTokens: oauthAccessToken
            ? { accessToken: oauthAccessToken }
            : undefined,
        }
      );

      await fetchCalendars(client);
      updateData.syncStatus = "VERBUNDEN";
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Verbindung fehlgeschlagen";
      return Response.json(
        { error: `CalDAV-Verbindung fehlgeschlagen: ${message}` },
        { status: 400 }
      );
    }

    if (data.passwort) {
      updateData.passwortEnc = encryptCalDavCredential(data.passwort);
    }
    if (data.oauthTokens) {
      updateData.oauthTokens = data.oauthTokens;
    }
  }

  const updated = await (prisma as any).calDavKonto.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      provider: true,
      name: true,
      serverUrl: true,
      benutzername: true,
      authTyp: true,
      selectedCalendarUrl: true,
      aktiv: true,
      syncStatus: true,
      letzterSync: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Response.json(updated);
}

/**
 * DELETE /api/caldav-konten/[id]
 * Delete a CalDAV account and all associated sync mappings (cascade).
 */
export async function DELETE(
  _req: NextRequest,
  context: RouteParams
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await context.params;

  // Verify ownership
  const existing = await (prisma as any).calDavKonto.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return Response.json({ error: "CalDAV-Konto nicht gefunden" }, { status: 404 });
  }

  await (prisma as any).calDavKonto.delete({
    where: { id },
  });

  return Response.json({ success: true });
}
