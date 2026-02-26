import { prisma } from "@/lib/db";
import { EmailComposeView } from "@/components/email/email-compose-view";

interface ComposePageProps {
  searchParams: Promise<{
    reply?: string;
    replyAll?: string;
    forward?: string;
    akteId?: string;
  }>;
}

export default async function EmailComposePage({
  searchParams,
}: ComposePageProps) {
  const { reply, replyAll, forward, akteId } = await searchParams;

  // Load referenced email if replying or forwarding
  const refEmailId = reply || replyAll || forward;
  let refEmail = null;
  if (refEmailId) {
    refEmail = await prisma.emailMessage.findUnique({
      where: { id: refEmailId },
      select: {
        id: true,
        betreff: true,
        absender: true,
        absenderName: true,
        empfaenger: true,
        cc: true,
        inhalt: true,
        inhaltText: true,
        akteId: true,
        richtung: true,
      },
    });
  }

  // Determine compose mode
  let mode: "new" | "reply" | "replyAll" | "forward" = "new";
  if (reply) mode = "reply";
  else if (replyAll) mode = "replyAll";
  else if (forward) mode = "forward";

  // Load akten for optional akte linking
  const akten = await prisma.akte.findMany({
    where: { status: { in: ["OFFEN", "RUHEND"] } },
    select: { id: true, aktenzeichen: true, kurzrubrum: true },
    orderBy: { geaendert: "desc" },
    take: 100,
  });

  return (
    <EmailComposeView
      mode={mode}
      refEmail={refEmail ? JSON.parse(JSON.stringify(refEmail)) : null}
      akten={akten}
      defaultAkteId={akteId ?? refEmail?.akteId ?? null}
    />
  );
}
