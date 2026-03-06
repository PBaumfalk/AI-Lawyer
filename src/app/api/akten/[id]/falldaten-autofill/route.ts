import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAkteAccess } from "@/lib/rbac";
import { extractFalldaten } from "@/lib/helena/falldaten-extractor";

// POST /api/akten/[id]/falldaten-autofill
// Trigger AI extraction of Falldaten from Akte documents
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  // RBAC: check Akte access
  const access = await requireAkteAccess(akteId);
  if (access.error) return access.error;

  const { session } = access;

  try {
    // Load Akte with falldatenTemplate
    const akte = await prisma.akte.findUnique({
      where: { id: akteId },
      select: {
        id: true,
        falldatenTemplateId: true,
        falldatenTemplate: {
          select: {
            id: true,
            name: true,
            schema: true,
          },
        },
      },
    });

    if (!akte) {
      return NextResponse.json(
        { error: "Akte nicht gefunden" },
        { status: 404 }
      );
    }

    if (!akte.falldatenTemplate) {
      return NextResponse.json(
        { error: "Kein Falldatenblatt-Template zugewiesen" },
        { status: 400 }
      );
    }

    // Extract template fields
    const templateSchema = akte.falldatenTemplate.schema as {
      felder: Array<{
        key: string;
        label: string;
        typ: string;
        placeholder?: string | null;
        optionen?: { value: string; label: string }[] | null;
        required?: boolean;
        gruppe?: string | null;
      }>;
    };

    if (!templateSchema?.felder || templateSchema.felder.length === 0) {
      return NextResponse.json(
        { error: "Template hat keine Felder definiert" },
        { status: 400 }
      );
    }

    // Run extraction
    const suggestions = await extractFalldaten({
      prisma,
      akteId,
      felder: templateSchema.felder,
      userId: session.user.id,
    });

    return NextResponse.json({ suggestions });
  } catch (err: any) {
    console.error("[falldaten-autofill] Error:", err);
    return NextResponse.json(
      { error: err.message || "Fehler bei der KI-Extraktion" },
      { status: 500 }
    );
  }
}
