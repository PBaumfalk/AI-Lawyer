import { AkteEmailTab } from "@/components/email/akte-email-tab";

interface AkteEmailsPageProps {
  params: Promise<{ id: string }>;
}

/**
 * /akten/[id]/emails — Dedicated page for Akte email tab.
 * Renders the AkteEmailTab component with the akteId from params.
 * This page can also be accessed directly via URL.
 */
export default async function AkteEmailsPage({ params }: AkteEmailsPageProps) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading text-foreground">
          Akte E-Mails
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Alle verakteten E-Mails fuer diese Akte
        </p>
      </div>
      <AkteEmailTab akteId={id} />
    </div>
  );
}
