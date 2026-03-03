import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SessionProvider } from "@/components/providers/session-provider";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalHeader } from "@/components/portal/portal-header";

// All portal pages require auth + fresh data -- skip static generation during build
export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || (session.user as any).role !== "MANDANT") {
    redirect("/portal/login");
  }

  // Fetch Kanzlei branding from standard Briefkopf
  const briefkopf = await prisma.briefkopf.findFirst({
    where: { istStandard: true },
    select: { kanzleiName: true, logoUrl: true },
  });

  const kanzleiName = briefkopf?.kanzleiName ?? "Kanzlei";
  const logoUrl = briefkopf?.logoUrl ?? null;

  return (
    <SessionProvider>
      <div className="flex h-screen overflow-hidden">
        <PortalSidebar kanzleiName={kanzleiName} logoUrl={logoUrl} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <PortalHeader kanzleiName={kanzleiName} />
          <main className="flex-1 overflow-y-auto p-6 bg-transparent">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
