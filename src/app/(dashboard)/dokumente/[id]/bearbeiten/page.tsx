import { OnlyOfficeEditor } from "@/components/editor/onlyoffice-editor";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface BearbeitenPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Document editor page at /dokumente/[id]/bearbeiten.
 * Opens the document in OnlyOffice for editing.
 * Falls back to view mode for FREIGEGEBEN/VERSENDET documents.
 */
export default async function BearbeitenPage({ params }: BearbeitenPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  const dokument = await prisma.dokument.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      akteId: true,
      akte: { select: { aktenzeichen: true, kurzrubrum: true } },
    },
  });

  if (!dokument) {
    redirect("/dokumente");
  }

  const isReadOnly =
    dokument.status === "FREIGEGEBEN" || dokument.status === "VERSENDET";
  const mode = isReadOnly ? "view" : "edit";

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Navigation bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex-shrink-0">
        <Link
          href={`/akten/${dokument.akteId}/dokumente/${dokument.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurueck zum Dokument
        </Link>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <span className="text-sm font-medium truncate">{dokument.name}</span>
        <span className="text-xs text-slate-400">
          {dokument.akte.aktenzeichen} - {dokument.akte.kurzrubrum}
        </span>
        {isReadOnly && (
          <span className="ml-auto text-xs text-amber-600 dark:text-amber-400 font-medium">
            Nur-Lesen
          </span>
        )}
      </div>

      {/* Editor fills remaining space */}
      <div className="flex-1 min-h-0 relative">
        <OnlyOfficeEditor dokumentId={id} mode={mode} />
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: BearbeitenPageProps) {
  const { id } = await params;

  const dokument = await prisma.dokument.findUnique({
    where: { id },
    select: { name: true },
  });

  return {
    title: dokument ? `${dokument.name} bearbeiten` : "Dokument bearbeiten",
  };
}
