import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireMandantAkteAccess } from "@/lib/portal-access";
import { PortalMessaging } from "@/components/portal/portal-messaging";

export const dynamic = "force-dynamic";

interface PortalAkteNachrichtenPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Per-Akte nachrichten page.
 * Renders the PortalMessaging component for the specific Akte.
 */
export default async function PortalAkteNachrichtenPage({
  params,
}: PortalAkteNachrichtenPageProps) {
  const { id: akteId } = await params;

  const session = await auth();
  if (!session?.user || (session.user as any).role !== "MANDANT") {
    redirect("/portal/login");
  }

  // Verify Mandant has access to this Akte
  const access = await requireMandantAkteAccess(akteId, session.user.id);
  if (access.error) {
    redirect("/portal/dashboard");
  }

  return (
    <div className="flex flex-col h-full">
      <PortalMessaging akteId={akteId} />
    </div>
  );
}
