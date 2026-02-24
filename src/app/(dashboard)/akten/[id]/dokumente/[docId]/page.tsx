import { DocumentDetail } from "@/components/dokumente/document-detail";

interface DokumentDetailPageProps {
  params: Promise<{ id: string; docId: string }>;
}

/**
 * Document detail page at /akten/[id]/dokumente/[docId].
 * Renders the split-view document viewer with metadata panel.
 */
export default async function DokumentDetailPage({
  params,
}: DokumentDetailPageProps) {
  const { id, docId } = await params;

  return <DocumentDetail akteId={id} dokumentId={docId} />;
}

export async function generateMetadata({
  params,
}: DokumentDetailPageProps) {
  const { docId } = await params;
  return {
    title: `Dokument ${docId.slice(0, 8)}`,
  };
}
