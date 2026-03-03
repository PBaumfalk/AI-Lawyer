import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getMandantAkten,
  requireMandantAkteAccess,
} from "@/lib/portal-access";
import { prisma } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PortalAkteTabs } from "@/components/portal/portal-akte-tabs";

export const dynamic = "force-dynamic";

interface PortalAkteLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function PortalAkteLayout({
  children,
  params,
}: PortalAkteLayoutProps) {
  const { id } = await params;

  // Auth check -- redirect unauthenticated or non-MANDANT users
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "MANDANT") {
    redirect("/portal/login");
  }

  // Verify Mandant has access to this Akte
  const access = await requireMandantAkteAccess(id, session.user.id);
  if (access.error) {
    redirect("/portal/dashboard");
  }

  // Fetch Akte title data (lightweight -- only aktenzeichen + kurzrubrum)
  const akte = await prisma.akte.findUnique({
    where: { id },
    select: {
      aktenzeichen: true,
      kurzrubrum: true,
    },
  });

  if (!akte) {
    redirect("/portal/dashboard");
  }

  // Determine if back link should show (only for multi-Akte Mandanten)
  const allAkten = await getMandantAkten(session.user.id);
  const hasMultipleAkten = allAkten.length > 1;

  return (
    <div className="space-y-6">
      {/* Back link (only for multi-Akte Mandanten) */}
      {hasMultipleAkten && (
        <Link
          href="/portal/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurueck zur Uebersicht
        </Link>
      )}

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {akte.aktenzeichen}
        </h1>
        <p className="text-muted-foreground mt-0.5">{akte.kurzrubrum}</p>
      </div>

      {/* Tab navigation */}
      <PortalAkteTabs akteId={id} />

      {/* Tab content */}
      {children}
    </div>
  );
}
