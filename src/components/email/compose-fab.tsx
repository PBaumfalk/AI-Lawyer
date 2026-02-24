"use client";

import { Pencil } from "lucide-react";
import { useComposeManager } from "@/components/email/compose-manager";

/**
 * Floating action button for composing new emails.
 * Gmail-style FAB positioned in the bottom-right corner.
 * Visible on all email pages via the email layout.
 *
 * Z-index z-[80] sits between:
 * - Upload panel (z-50)
 * - Minimized compose tabs (z-[85])
 */
export function ComposeFab() {
  const { openCompose } = useComposeManager();

  return (
    <button
      type="button"
      onClick={() => openCompose()}
      className="fixed bottom-6 right-6 z-[80] flex items-center gap-2 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all"
      aria-label="Neue E-Mail verfassen"
    >
      <Pencil className="w-5 h-5" />
      <span className="hidden sm:inline font-medium">Neue E-Mail</span>
    </button>
  );
}
