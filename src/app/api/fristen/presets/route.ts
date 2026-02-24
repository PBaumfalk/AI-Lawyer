import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { DEFAULT_FRISTEN_PRESETS } from "@/lib/fristen";

const createPresetSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  fristArt: z.enum(["EREIGNISFRIST", "BEGINNFRIST"]),
  dauerWochen: z.number().int().min(0).nullable().optional(),
  dauerMonate: z.number().int().min(0).nullable().optional(),
  dauerTage: z.number().int().min(0).nullable().optional(),
  istNotfrist: z.boolean().optional().default(false),
  defaultVorfristen: z.array(z.number().int().min(0)).optional().default([7, 3, 1]),
  kategorie: z.string().min(1, "Kategorie ist erforderlich"),
  beschreibung: z.string().nullable().optional(),
  rechtsgrundlage: z.string().nullable().optional(),
  sortierung: z.number().int().optional().default(0),
});

const updatePresetSchema = z.object({
  id: z.string().min(1, "ID ist erforderlich"),
  name: z.string().min(1).optional(),
  fristArt: z.enum(["EREIGNISFRIST", "BEGINNFRIST"]).optional(),
  dauerWochen: z.number().int().min(0).nullable().optional(),
  dauerMonate: z.number().int().min(0).nullable().optional(),
  dauerTage: z.number().int().min(0).nullable().optional(),
  istNotfrist: z.boolean().optional(),
  defaultVorfristen: z.array(z.number().int().min(0)).optional(),
  kategorie: z.string().min(1).optional(),
  beschreibung: z.string().nullable().optional(),
  rechtsgrundlage: z.string().nullable().optional(),
  sortierung: z.number().int().optional(),
});

/**
 * Seed default presets if none exist.
 * Called on first GET request.
 */
async function seedDefaultPresets() {
  const count = await prisma.fristPreset.count();
  if (count > 0) return;

  const presets = DEFAULT_FRISTEN_PRESETS.map((p, index) => ({
    name: p.name,
    fristArt: p.fristArt,
    dauerWochen: p.dauer.wochen ?? null,
    dauerMonate: p.dauer.monate ?? null,
    dauerTage: p.dauer.tage ?? null,
    istNotfrist: p.istNotfrist,
    defaultVorfristen: p.defaultVorfristen,
    kategorie: p.kategorie,
    rechtsgrundlage: p.rechtsgrundlage,
    beschreibung: null,
    sortierung: index,
    aktiv: true,
  }));

  await prisma.fristPreset.createMany({ data: presets });
}

/**
 * GET /api/fristen/presets - List all active presets
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // Seed defaults on first access
  await seedDefaultPresets();

  const presets = await prisma.fristPreset.findMany({
    where: { aktiv: true },
    orderBy: [{ sortierung: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(presets);
}

/**
 * POST /api/fristen/presets - Create new preset (ADMIN only)
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    return NextResponse.json({ error: "Nur Administratoren koennen Presets erstellen" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createPresetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const preset = await prisma.fristPreset.create({
    data: {
      name: parsed.data.name,
      fristArt: parsed.data.fristArt,
      dauerWochen: parsed.data.dauerWochen ?? null,
      dauerMonate: parsed.data.dauerMonate ?? null,
      dauerTage: parsed.data.dauerTage ?? null,
      istNotfrist: parsed.data.istNotfrist,
      defaultVorfristen: parsed.data.defaultVorfristen,
      kategorie: parsed.data.kategorie,
      beschreibung: parsed.data.beschreibung ?? null,
      rechtsgrundlage: parsed.data.rechtsgrundlage ?? null,
      sortierung: parsed.data.sortierung,
    },
  });

  return NextResponse.json(preset, { status: 201 });
}

/**
 * PUT /api/fristen/presets - Update preset (ADMIN only)
 */
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    return NextResponse.json({ error: "Nur Administratoren koennen Presets bearbeiten" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updatePresetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id, ...updateData } = parsed.data;

  const existing = await prisma.fristPreset.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Preset nicht gefunden" }, { status: 404 });
  }

  const updated = await prisma.fristPreset.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/fristen/presets - Soft-delete preset (ADMIN only)
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    return NextResponse.json({ error: "Nur Administratoren koennen Presets loeschen" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID ist erforderlich" }, { status: 400 });
  }

  const existing = await prisma.fristPreset.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Preset nicht gefunden" }, { status: 404 });
  }

  // Soft-delete: set aktiv=false
  await prisma.fristPreset.update({
    where: { id },
    data: { aktiv: false },
  });

  return NextResponse.json({ success: true });
}
