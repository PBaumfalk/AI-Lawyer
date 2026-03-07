import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { encryptCalDavCredential } from "@/lib/caldav/crypto";
import { createCalDavClient, fetchCalendars } from "@/lib/caldav/client";
import type { CalDavProvider } from "@/lib/caldav/types";

const createSchema = z.object({
  provider: z.enum(["GOOGLE", "APPLE"]),
  name: z.string().min(1, "Name ist erforderlich"),
  serverUrl: z.string().url("Ungueltige Server-URL"),
  benutzername: z.string().min(1, "Benutzername ist erforderlich"),
  passwort: z.string().optional(),
  oauthTokens: z
    .object({
      accessToken: z.string(),
      refreshToken: z.string(),
      expiresAt: z.string(),
    })
    .optional(),
});

/**
 * GET /api/caldav-konten
 * List all CalDAV accounts for the current user.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const konten = await (prisma as any).calDavKonto.findMany({
    where: { userId: session.user.id },
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
      fehlerLog: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" as const },
  });

  return Response.json(konten);
}

/**
 * POST /api/caldav-konten
 * Create a new CalDAV account with connection validation.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Ungueltige Eingabe", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Determine auth type based on provider
  const authTyp = data.provider === "GOOGLE" ? "OAUTH2" : "PASSWORT";

  // Validate credentials are provided for the auth type
  if (authTyp === "PASSWORT" && !data.passwort) {
    return Response.json(
      { error: "App-spezifisches Passwort ist fuer Apple iCloud erforderlich" },
      { status: 400 }
    );
  }

  if (authTyp === "OAUTH2" && !data.oauthTokens) {
    return Response.json(
      { error: "OAuth2-Tokens sind fuer Google Calendar erforderlich" },
      { status: 400 }
    );
  }

  // Validate connection by trying to fetch calendars
  let calendars;
  try {
    const client = await createCalDavClient(
      data.provider as CalDavProvider,
      data.serverUrl,
      {
        username: data.benutzername,
        password: data.passwort,
        oauthTokens: data.oauthTokens
          ? { accessToken: data.oauthTokens.accessToken }
          : undefined,
      }
    );

    calendars = await fetchCalendars(client);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Verbindung fehlgeschlagen";
    return Response.json(
      { error: `CalDAV-Verbindung fehlgeschlagen: ${message}` },
      { status: 400 }
    );
  }

  // Encrypt password if provided
  let passwortEnc: string | null = null;
  if (data.passwort) {
    passwortEnc = encryptCalDavCredential(data.passwort);
  }

  // Store OAuth tokens as JSON
  const oauthTokens = data.oauthTokens ? data.oauthTokens : null;

  const konto = await (prisma as any).calDavKonto.create({
    data: {
      userId: session.user.id!,
      provider: data.provider,
      name: data.name,
      serverUrl: data.serverUrl,
      benutzername: data.benutzername,
      passwortEnc,
      oauthTokens,
      authTyp,
      syncStatus: "VERBUNDEN",
    },
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
      createdAt: true,
    },
  });

  return Response.json({ konto, calendars }, { status: 201 });
}
