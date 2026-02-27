import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import { generateBriefkopfDocx, BriefkopfData, BriefkopfDesign } from "@/lib/briefkopf";

/**
 * GET /api/briefkopf -- list all Briefkoepfe
 * Returns all letterheads with a flag indicating which is the default.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const briefkoepfe = await prisma.briefkopf.findMany({
    orderBy: [{ istStandard: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ briefkoepfe });
}

/**
 * POST /api/briefkopf -- create a new Briefkopf
 * Accepts multipart/form-data with:
 *   - name: Display name (required)
 *   - logo: Logo image file (optional)
 *   - docx: DOCX file with header/footer (optional)
 *   - kanzleiName, adresse, telefon, fax, email, website, steuernr,
 *     ustIdNr, iban, bic, bankName, braoInfo: Structured form fields (optional)
 *   - istStandard: "true" to set as default (optional)
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const formData = await request.formData();
  const name = formData.get("name") as string | null;
  const logo = formData.get("logo") as File | null;
  const docx = formData.get("docx") as File | null;
  const istStandard = formData.get("istStandard") === "true";
  const design = ((formData.get("design") as string) || "klassisch") as BriefkopfDesign;

  if (!name?.trim()) {
    return NextResponse.json(
      { error: "Name ist erforderlich" },
      { status: 400 }
    );
  }

  try {
    let logoUrl: string | null = null;
    let logoBuffer: Buffer | null = null;
    let dateipfad: string | null = null;

    // Parse anwaelte from JSON string or comma-separated
    const anwaelteRaw = formData.get("anwaelte") as string | null;
    let anwaelte: string[] = [];
    if (anwaelteRaw) {
      try {
        anwaelte = JSON.parse(anwaelteRaw);
      } catch {
        anwaelte = anwaelteRaw.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }

    // Upload logo if provided — keep buffer for DOCX generation
    if (logo) {
      logoBuffer = Buffer.from(await logo.arrayBuffer());
      const timestamp = Date.now();
      const sanitized = logo.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_");
      logoUrl = `briefkoepfe/logos/${timestamp}_${sanitized}`;
      await uploadFile(logoUrl, logoBuffer, logo.type, logoBuffer.length);
    }

    // Upload DOCX template if provided; otherwise auto-generate from fields
    if (docx) {
      const docxBuffer = Buffer.from(await docx.arrayBuffer());
      const timestamp = Date.now();
      const sanitized = docx.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_");
      dateipfad = `briefkoepfe/vorlagen/${timestamp}_${sanitized}`;
      await uploadFile(dateipfad, docxBuffer, docx.type, docxBuffer.length);
    } else {
      // Auto-generate DOCX from text fields
      const fields: BriefkopfData = {
        kanzleiName: (formData.get("kanzleiName") as string) || null,
        adresse: (formData.get("adresse") as string) || null,
        telefon: (formData.get("telefon") as string) || null,
        fax: (formData.get("fax") as string) || null,
        email: (formData.get("email") as string) || null,
        website: (formData.get("website") as string) || null,
        steuernr: (formData.get("steuernr") as string) || null,
        ustIdNr: (formData.get("ustIdNr") as string) || null,
        iban: (formData.get("iban") as string) || null,
        bic: (formData.get("bic") as string) || null,
        bankName: (formData.get("bankName") as string) || null,
        braoInfo: (formData.get("braoInfo") as string) || null,
        anwaelte,
      };
      const generated = generateBriefkopfDocx(fields, logoBuffer, logo?.type ?? null, design);
      const timestamp = Date.now();
      dateipfad = `briefkoepfe/vorlagen/${timestamp}_generated.docx`;
      await uploadFile(
        dateipfad,
        generated,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        generated.length
      );
    }

    // If setting as default, unset all others
    if (istStandard) {
      await prisma.briefkopf.updateMany({
        where: { istStandard: true },
        data: { istStandard: false },
      });
    }

    const briefkopf = await prisma.briefkopf.create({
      data: {
        name: name.trim(),
        dateipfad,
        logoUrl,
        kanzleiName: (formData.get("kanzleiName") as string) || null,
        adresse: (formData.get("adresse") as string) || null,
        telefon: (formData.get("telefon") as string) || null,
        fax: (formData.get("fax") as string) || null,
        email: (formData.get("email") as string) || null,
        website: (formData.get("website") as string) || null,
        steuernr: (formData.get("steuernr") as string) || null,
        ustIdNr: (formData.get("ustIdNr") as string) || null,
        iban: (formData.get("iban") as string) || null,
        bic: (formData.get("bic") as string) || null,
        bankName: (formData.get("bankName") as string) || null,
        braoInfo: (formData.get("braoInfo") as string) || null,
        anwaelte,
        design,
        istStandard,
      },
    });

    return NextResponse.json({ briefkopf }, { status: 201 });
  } catch (err: any) {
    console.error("Briefkopf creation error:", err);
    return NextResponse.json(
      { error: err.message?.slice(0, 200) ?? "Fehler beim Erstellen" },
      { status: 500 }
    );
  }
}
