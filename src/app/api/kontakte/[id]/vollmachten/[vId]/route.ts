import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateVollmachtSchema = z.object({
  nehmerId: z.string().optional(),
  typ: z.enum(["EINZELVOLLMACHT", "GENERALVOLLMACHT", "PROZESSVOLLMACHT", "VORSORGEVOLLMACHT", "SONSTIGE"]).optional(),
  umfang: z.string().nullable().optional(),
  erteilungsdatum: z.string().nullable().optional(),
  beginn: z.string().nullable().optional(),
  ende: z.string().nullable().optional(),
  beschraenkungen: z.string().nullable().optional(),
});

// PATCH /api/kontakte/[id]/vollmachten/[vId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; vId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id, vId } = await params;
  const body = await request.json();
  const parsed = updateVollmachtSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const vollmacht = await prisma.vollmacht.findFirst({
    where: { id: vId, geberId: id },
  });
  if (!vollmacht) {
    return NextResponse.json({ error: "Vollmacht nicht gefunden" }, { status: 404 });
  }

  const data: any = { ...parsed.data };
  for (const dateField of ["erteilungsdatum", "beginn", "ende"]) {
    if (data[dateField] && typeof data[dateField] === "string") {
      data[dateField] = new Date(data[dateField]);
    }
  }

  const updated = await prisma.vollmacht.update({
    where: { id: vId },
    data,
    include: {
      nehmer: { select: { id: true, vorname: true, nachname: true, firma: true, typ: true } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/kontakte/[id]/vollmachten/[vId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; vId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id, vId } = await params;
  const vollmacht = await prisma.vollmacht.findFirst({
    where: { id: vId, geberId: id },
  });
  if (!vollmacht) {
    return NextResponse.json({ error: "Vollmacht nicht gefunden" }, { status: 404 });
  }

  await prisma.vollmacht.delete({ where: { id: vId } });
  return NextResponse.json({ success: true });
}
