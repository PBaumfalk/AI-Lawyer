import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteFile, uploadFile, getDownloadUrl, getFileStream } from "@/lib/storage";
import { generateBriefkopfDocx, BriefkopfData, BriefkopfDesign } from "@/lib/briefkopf";

/**
 * GET /api/briefkopf/[id] -- get a single Briefkopf
 * Query: download=true to get download URL for the DOCX
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const download = searchParams.get("download");

  const briefkopf = await prisma.briefkopf.findUnique({ where: { id } });
  if (!briefkopf) {
    return NextResponse.json(
      { error: "Briefkopf nicht gefunden" },
      { status: 404 }
    );
  }

  if (download === "true" && briefkopf.dateipfad) {
    const url = await getDownloadUrl(briefkopf.dateipfad);
    return NextResponse.redirect(url);
  }

  return NextResponse.json({ briefkopf });
}

/**
 * PUT /api/briefkopf/[id] -- update a Briefkopf
 * Accepts multipart/form-data with same fields as POST
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const briefkopf = await prisma.briefkopf.findUnique({ where: { id } });
  if (!briefkopf) {
    return NextResponse.json(
      { error: "Briefkopf nicht gefunden" },
      { status: 404 }
    );
  }

  const formData = await request.formData();
  const updateData: any = {};

  // Update text fields
  const textFields = [
    "name",
    "kanzleiName",
    "adresse",
    "telefon",
    "fax",
    "email",
    "website",
    "steuernr",
    "ustIdNr",
    "iban",
    "bic",
    "bankName",
    "braoInfo",
    "design",
  ];
  for (const field of textFields) {
    const value = formData.get(field) as string | null;
    if (value !== null) {
      updateData[field] = value.trim() || null;
    }
  }

  // Update anwaelte (array field)
  const anwaelteRaw = formData.get("anwaelte") as string | null;
  if (anwaelteRaw !== null) {
    try {
      updateData.anwaelte = JSON.parse(anwaelteRaw);
    } catch {
      updateData.anwaelte = anwaelteRaw.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
  }

  // Upload new logo if provided; keep buffer for DOCX regeneration
  const logo = formData.get("logo") as File | null;
  let newLogoBuffer: Buffer | null = null;
  let newLogoMime: string | null = null;

  if (logo) {
    newLogoBuffer = Buffer.from(await logo.arrayBuffer());
    newLogoMime = logo.type;
    const timestamp = Date.now();
    const sanitized = logo.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_");
    const logoUrl = `briefkoepfe/logos/${timestamp}_${sanitized}`;
    await uploadFile(logoUrl, newLogoBuffer, logo.type, newLogoBuffer.length);

    // Delete old logo
    if (briefkopf.logoUrl) {
      try {
        await deleteFile(briefkopf.logoUrl);
      } catch {
        // Continue
      }
    }
    updateData.logoUrl = logoUrl;
  }

  // Upload new DOCX if provided; otherwise auto-generate if no custom DOCX exists
  const docx = formData.get("docx") as File | null;
  if (docx) {
    const docxBuffer = Buffer.from(await docx.arrayBuffer());
    const timestamp = Date.now();
    const sanitized = docx.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_");
    const dateipfad = `briefkoepfe/vorlagen/${timestamp}_${sanitized}`;
    await uploadFile(dateipfad, docxBuffer, docx.type, docxBuffer.length);

    // Delete old DOCX
    if (briefkopf.dateipfad) {
      try {
        await deleteFile(briefkopf.dateipfad);
      } catch {
        // Continue
      }
    }
    updateData.dateipfad = dateipfad;
  } else if (
    !briefkopf.dateipfad ||
    briefkopf.dateipfad.endsWith("_generated.docx")
  ) {
    // Auto-regenerate: no manual DOCX exists or the existing one was itself auto-generated
    // Resolve logo buffer: prefer newly uploaded, fall back to existing MinIO logo
    let logoBuffer: Buffer | null = newLogoBuffer;
    let logoMime: string | null = newLogoMime;

    if (!logoBuffer) {
      const existingLogoUrl = updateData.logoUrl ?? briefkopf.logoUrl;
      if (existingLogoUrl) {
        try {
          const stream = await getFileStream(existingLogoUrl as string);
          if (stream) {
            const chunks: Buffer[] = [];
            for await (const chunk of stream as AsyncIterable<Uint8Array>) {
              chunks.push(Buffer.from(chunk));
            }
            logoBuffer = Buffer.concat(chunks);
            // Infer MIME from stored path extension
            const ext = (existingLogoUrl as string).split(".").pop()?.toLowerCase() ?? "";
            const extMimeMap: Record<string, string> = {
              png: "image/png",
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              gif: "image/gif",
              webp: "image/webp",
            };
            logoMime = extMimeMap[ext] ?? "image/png";
          }
        } catch {
          // Logo unavailable — generate without it
          logoBuffer = null;
          logoMime = null;
        }
      }
    }

    // Build merged fields (prefer formData values over existing DB values)
    const mergedFields: BriefkopfData = {
      kanzleiName:
        (updateData.kanzleiName !== undefined
          ? updateData.kanzleiName
          : briefkopf.kanzleiName) ?? null,
      adresse:
        (updateData.adresse !== undefined
          ? updateData.adresse
          : briefkopf.adresse) ?? null,
      telefon:
        (updateData.telefon !== undefined
          ? updateData.telefon
          : briefkopf.telefon) ?? null,
      fax:
        (updateData.fax !== undefined ? updateData.fax : briefkopf.fax) ?? null,
      email:
        (updateData.email !== undefined
          ? updateData.email
          : briefkopf.email) ?? null,
      website:
        (updateData.website !== undefined
          ? updateData.website
          : briefkopf.website) ?? null,
      steuernr:
        (updateData.steuernr !== undefined
          ? updateData.steuernr
          : briefkopf.steuernr) ?? null,
      ustIdNr:
        (updateData.ustIdNr !== undefined
          ? updateData.ustIdNr
          : briefkopf.ustIdNr) ?? null,
      iban:
        (updateData.iban !== undefined ? updateData.iban : briefkopf.iban) ??
        null,
      bic:
        (updateData.bic !== undefined ? updateData.bic : briefkopf.bic) ?? null,
      bankName:
        (updateData.bankName !== undefined
          ? updateData.bankName
          : briefkopf.bankName) ?? null,
      braoInfo:
        (updateData.braoInfo !== undefined
          ? updateData.braoInfo
          : briefkopf.braoInfo) ?? null,
      anwaelte:
        updateData.anwaelte !== undefined
          ? updateData.anwaelte
          : briefkopf.anwaelte ?? [],
    };

    const mergedDesign = ((updateData.design ?? briefkopf.design ?? "klassisch") as BriefkopfDesign);
    const generated = generateBriefkopfDocx(mergedFields, logoBuffer, logoMime, mergedDesign);
    const timestamp = Date.now();
    const newDateipfad = `briefkoepfe/vorlagen/${timestamp}_generated.docx`;
    await uploadFile(
      newDateipfad,
      generated,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      generated.length
    );

    // Delete old auto-generated DOCX
    if (briefkopf.dateipfad) {
      try {
        await deleteFile(briefkopf.dateipfad);
      } catch {
        // Continue
      }
    }
    updateData.dateipfad = newDateipfad;
  }

  try {
    const updated = await prisma.briefkopf.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ briefkopf: updated });
  } catch (err: any) {
    console.error("Briefkopf update error:", err);
    return NextResponse.json(
      { error: err.message?.slice(0, 200) ?? "Fehler beim Aktualisieren" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/briefkopf/[id] -- set as default Briefkopf
 * Body: { action: "setDefault" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const body = await request.json();

  if (body.action !== "setDefault") {
    return NextResponse.json(
      { error: "Ungueltige Aktion" },
      { status: 400 }
    );
  }

  const briefkopf = await prisma.briefkopf.findUnique({ where: { id } });
  if (!briefkopf) {
    return NextResponse.json(
      { error: "Briefkopf nicht gefunden" },
      { status: 404 }
    );
  }

  // Unset all others, set this one as default
  await prisma.$transaction([
    prisma.briefkopf.updateMany({
      where: { istStandard: true },
      data: { istStandard: false },
    }),
    prisma.briefkopf.update({
      where: { id },
      data: { istStandard: true },
    }),
  ]);

  const updated = await prisma.briefkopf.findUnique({ where: { id } });
  return NextResponse.json({ briefkopf: updated });
}

/**
 * DELETE /api/briefkopf/[id] -- delete a Briefkopf
 * Cannot delete if it's the only one or if it's the default.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const briefkopf = await prisma.briefkopf.findUnique({ where: { id } });
  if (!briefkopf) {
    return NextResponse.json(
      { error: "Briefkopf nicht gefunden" },
      { status: 404 }
    );
  }

  // Check if it's the default
  if (briefkopf.istStandard) {
    return NextResponse.json(
      {
        error:
          "Der Standard-Briefkopf kann nicht geloescht werden. Setzen Sie zuerst einen anderen als Standard.",
      },
      { status: 400 }
    );
  }

  // Check if it's the only one
  const count = await prisma.briefkopf.count();
  if (count <= 1) {
    return NextResponse.json(
      { error: "Der letzte Briefkopf kann nicht geloescht werden" },
      { status: 400 }
    );
  }

  // Delete files from MinIO
  if (briefkopf.dateipfad) {
    try {
      await deleteFile(briefkopf.dateipfad);
    } catch {
      // Continue
    }
  }
  if (briefkopf.logoUrl) {
    try {
      await deleteFile(briefkopf.logoUrl);
    } catch {
      // Continue
    }
  }

  await prisma.briefkopf.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
