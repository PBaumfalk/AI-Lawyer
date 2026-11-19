import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { PERMISSIONS, canAccessAkte } from "@/lib/rbac";
import { BeaMessageDetail, type BeaAnhangAnzeige } from "@/components/bea/bea-message-detail";

interface BeaDetailPageProps {
  params: Promise<{ id: string }>;
}

/** Strips storage keys: downloads go through the routes by attachment id or document id. */
function anhaengeFuerClient(anhaenge: unknown): BeaAnhangAnzeige[] {
  if (!Array.isArray(anhaenge)) return [];
  return anhaenge
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
    .map((a) => ({
      id: typeof a.id === "string" ? a.id : null,
      name: typeof a.name === "string" ? a.name : "Anhang",
      mimeType: typeof a.mimeType === "string" ? a.mimeType : null,
      groesse: typeof a.groesse === "number" ? a.groesse : null,
      art: typeof a.art === "string" ? a.art : null,
      dokumentId: typeof a.dokumentId === "string" ? a.dokumentId : null,
      herunterladbar: typeof a.id === "string" && typeof a.storageKey === "string",
    }));
}

export default async function BeaDetailPage({ params }: BeaDetailPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { id: string; role: UserRole };

  // Same checks as GET /api/bea/messages/[id]: canReadBeA, and Akte access for assigned messages.
  // Both answer "not found" so the existence of a message is not revealed.
  if (!PERMISSIONS[user.role]?.canReadBeA) notFound();

  const { id } = await params;

  const nachricht = await prisma.beaNachricht.findUnique({
    where: { id },
    select: {
      id: true,
      akteId: true,
      betreff: true,
      absender: true,
      empfaenger: true,
      inhalt: true,
      status: true,
      richtung: true,
      eebAngefordert: true,
      eebStatus: true,
      eebDatum: true,
      safeIdAbsender: true,
      safeIdEmpfaenger: true,
      pruefprotokoll: true,
      anhaenge: true,
      xjustizData: true,
      empfangenAm: true,
      gesendetAm: true,
      createdAt: true,
      akte: {
        select: { id: true, aktenzeichen: true, kurzrubrum: true },
      },
    },
  });

  if (!nachricht) notFound();
  if (nachricht.akteId && !(await canAccessAkte({ id: user.id, role: user.role }, nachricht.akteId))) {
    notFound();
  }

  // Fetch Helena suggestions for this message
  const suggestions = await prisma.helenaSuggestion.findMany({
    where: {
      OR: [
        { dokumentId: nachricht.id },
        // Also check if any suggestions reference this beA message
      ],
      status: "NEU",
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Serialize for client component
  const { akteId: _akteId, ...ohneAkteId } = nachricht;
  const serializedNachricht = {
    ...ohneAkteId,
    anhaenge: anhaengeFuerClient(nachricht.anhaenge),
    createdAt: nachricht.createdAt.toISOString(),
    empfangenAm: nachricht.empfangenAm?.toISOString() || null,
    gesendetAm: nachricht.gesendetAm?.toISOString() || null,
    eebDatum: nachricht.eebDatum?.toISOString() || null,
  };

  const serializedSuggestions = suggestions.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    readAt: s.readAt?.toISOString() || null,
  }));

  const userRole = user.role;

  return (
    <BeaMessageDetail
      nachricht={serializedNachricht}
      suggestions={serializedSuggestions}
      userRole={userRole}
    />
  );
}
