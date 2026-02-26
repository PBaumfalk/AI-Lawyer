import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { EmailDetailView } from "@/components/email/email-detail-view";

interface EmailDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EmailDetailPage({
  params,
}: EmailDetailPageProps) {
  const { id } = await params;

  const email = await prisma.emailMessage.findUnique({
    where: { id },
    include: {
      akte: {
        select: { id: true, aktenzeichen: true, kurzrubrum: true },
      },
      ticket: {
        select: { id: true, titel: true, status: true, prioritaet: true },
      },
    },
  });

  if (!email) {
    notFound();
  }

  // Mark as read if unread
  if (!email.gelesen) {
    await prisma.emailMessage.update({
      where: { id },
      data: { gelesen: true },
    });
  }

  // Fetch akten for the verakten dialog
  const akten = await prisma.akte.findMany({
    where: { status: { in: ["OFFEN", "RUHEND"] } },
    select: { id: true, aktenzeichen: true, kurzrubrum: true },
    orderBy: { geaendert: "desc" },
    take: 100,
  });

  return (
    <EmailDetailView
      email={JSON.parse(JSON.stringify(email))}
      akten={akten}
    />
  );
}
