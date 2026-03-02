/**
 * POST /api/dokumente/[id]/manual-text - Save manually entered text for a document.
 * Updates the document's OCR text and status, then enqueues an embedding job.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { embeddingQueue } from "@/lib/queue/queues";
import { z } from "zod";

const schema = z.object({
  text: z.string().min(1, "Text darf nicht leer sein").max(100000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id: dokumentId } = await params;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe" },
      { status: 400 }
    );
  }

  const dokument = await prisma.dokument.findUnique({
    where: { id: dokumentId },
    select: { id: true, akteId: true },
  });

  if (!dokument) {
    return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
  }

  // Save text and update OCR status
  await prisma.dokument.update({
    where: { id: dokumentId },
    data: {
      ocrText: parsed.data.text.trim(),
      ocrStatus: "ABGESCHLOSSEN",
      ocrFehler: null,
      ocrAbgeschlossen: new Date(),
    },
  });

  // Enqueue embedding job
  await embeddingQueue.add("embed-document", {
    dokumentId,
    akteId: dokument.akteId,
    ocrText: parsed.data.text.trim(),
  });

  return NextResponse.json({ success: true });
}
