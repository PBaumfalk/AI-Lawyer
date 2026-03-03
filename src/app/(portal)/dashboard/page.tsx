import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMandantAkten } from "@/lib/portal-access";
import { AkteAuswahl } from "@/components/portal/akte-auswahl";
import { FolderOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PortalDashboardPage() {
  const session = await auth();

  if (!session?.user || (session.user as any).role !== "MANDANT") {
    redirect("/portal/login");
  }

  const akten = await getMandantAkten(session.user.id);

  // Single Akte: skip selection, go directly to detail
  if (akten.length === 1) {
    redirect(`/portal/akten/${akten[0].id}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FolderOpen className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">
          Meine Vorgaenge
        </h1>
      </div>

      {akten.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <p className="text-muted-foreground">
            Sie haben derzeit keine aktiven Vorgaenge. Bitte wenden Sie sich an
            Ihre Kanzlei.
          </p>
        </div>
      ) : (
        <AkteAuswahl akten={akten} />
      )}
    </div>
  );
}
