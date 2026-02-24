"use client";

import { use } from "react";
import { InvoiceDetailView } from "@/components/finanzen/invoice-detail";

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <InvoiceDetailView invoiceId={id} />;
}
