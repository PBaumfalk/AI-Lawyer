"use client";

import { ComposeManager } from "@/components/email/compose-manager";
import { ComposeFab } from "@/components/email/compose-fab";

/**
 * Email-specific layout that removes outer padding from the dashboard
 * and provides the ComposeManager context for compose-from-anywhere.
 * Full-height email view subtracting header height (4rem).
 */
export default function EmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ComposeManager>
      <div className="h-[calc(100vh-4rem)] -m-6 overflow-hidden">
        {children}
      </div>
      <ComposeFab />
    </ComposeManager>
  );
}
