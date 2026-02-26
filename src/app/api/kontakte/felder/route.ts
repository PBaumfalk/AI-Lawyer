import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const feldSchema = z.object({
  key: z.string().min(1).regex(/^[a-z][a-zA-Z0-9_]*$/, "Key muss mit Kleinbuchstabe beginnen und darf nur alphanumerische Zeichen/Unterstriche enthalten"),
  label: z.string().min(1),
  typ: z.enum(["text", "number", "date", "select", "boolean"]),
  optionen: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  pflicht: z.boolean().optional(),
  sortierung: z.number().optional(),
});

// GET /api/kontakte/felder — list custom field definitions
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const felder = await prisma.kontaktFeldDefinition.findMany({
    where: { aktiv: true },
    orderBy: { sortierung: "asc" },
  });

  return NextResponse.json({ felder });
}

// POST /api/kontakte/felder — create a custom field definition
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // Only admins can manage custom fields
  const role = (session.user as any).role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = feldSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Check unique key
  const existing = await prisma.kontaktFeldDefinition.findUnique({
    where: { key: parsed.data.key },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Feld mit Key "${parsed.data.key}" existiert bereits` },
      { status: 409 }
    );
  }

  const feld = await prisma.kontaktFeldDefinition.create({
    data: parsed.data,
  });

  return NextResponse.json(feld, { status: 201 });
}
