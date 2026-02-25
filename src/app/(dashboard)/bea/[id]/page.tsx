import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BeaMessageDetail } from "@/components/bea/bea-message-detail";

interface BeaDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BeaDetailPage({ params }: BeaDetailPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const nachricht = await prisma.beaNachricht.findUnique({
    where: { id },
    include: {
      akte: {
        select: { id: true, aktenzeichen: true, kurzrubrum: true },
      },
    },
  });

  if (!nachricht) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-heading text-foreground">Nachricht nicht gefunden</h1>
        <div className="glass rounded-xl p-12 text-center">
          <p className="text-muted-foreground">
            Die angeforderte beA-Nachricht konnte nicht gefunden werden.
          </p>
        </div>
      </div>
    );
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
  const serializedNachricht = {
    ...nachricht,
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

  const userRole = (session.user as any).role;

  return (
    <BeaMessageDetail
      nachricht={serializedNachricht}
      suggestions={serializedSuggestions}
      userRole={userRole}
    />
  );
}
