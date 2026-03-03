import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMandantAkten } from "@/lib/portal-access";
import { PortalMessaging } from "@/components/portal/portal-messaging";
import { MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Portal /nachrichten page.
 * - Single Akte: renders PortalMessaging directly for that Akte.
 * - Multiple Akten: redirects to per-Akte nachrichten (using first Akte).
 *   In the future, could show an Akte selector.
 * - No Akten: shows an info message.
 */
export default async function PortalNachrichtenPage() {
  const session = await auth();

  if (!session?.user || (session.user as any).role !== "MANDANT") {
    redirect("/portal/login");
  }

  const akten = await getMandantAkten(session.user.id);

  // No Akten
  if (akten.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">
            Sie haben derzeit keine aktiven Vorgaenge.
          </p>
        </div>
      </div>
    );
  }

  // Single Akte: render messaging directly
  if (akten.length === 1) {
    return (
      <div className="flex flex-col h-full">
        <PortalMessaging akteId={akten[0].id} />
      </div>
    );
  }

  // Multiple Akten: redirect to first Akte's messaging page
  // In the future, this could be an Akte selector
  redirect(`/portal/akten/${akten[0].id}/nachrichten`);
}
