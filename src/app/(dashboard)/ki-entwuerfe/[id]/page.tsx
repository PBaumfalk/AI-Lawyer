import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { KiEntwurfDetail } from "@/components/ki/ki-entwurf-detail";

interface KiEntwurfDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function KiEntwurfDetailPage({ params }: KiEntwurfDetailPageProps) {
  const { id } = await params;

  const entwurf = await prisma.chatNachricht.findUnique({
    where: { id },
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      bezugDokument: { select: { id: true, name: true } },
    },
  });

  if (!entwurf || entwurf.userId !== null) notFound();

  return (
    <KiEntwurfDetail
      entwurf={{
        id: entwurf.id,
        akteId: entwurf.akteId,
        nachricht: entwurf.nachricht,
        bezugDokumentId: entwurf.bezugDokumentId,
        createdAt: entwurf.createdAt.toISOString(),
        akte: entwurf.akte,
        bezugDokument: entwurf.bezugDokument,
      }}
    />
  );
}
