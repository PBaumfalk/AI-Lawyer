"use client";

import { Mail, Settings, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmailEmptyStateProps {
  type: "no-mailbox" | "empty-folder" | "no-selection";
  lastSyncTime?: string;
}

/**
 * Empty state component for email views.
 * Shows contextual messages depending on the state.
 */
export function EmailEmptyState({ type, lastSyncTime }: EmailEmptyStateProps) {
  if (type === "no-mailbox") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <Mail className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-base font-medium text-foreground mb-1">
          Kein E-Mail-Konto eingerichtet
        </h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-xs">
          Ein Administrator muss ein E-Mail-Konto in den Einstellungen
          konfigurieren, um E-Mails zu empfangen.
        </p>
        <a href="/einstellungen">
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-1.5" />
            Zu den Einstellungen
          </Button>
        </a>
      </div>
    );
  }

  if (type === "empty-folder") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <Inbox className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-base font-medium text-foreground mb-1">
          Keine E-Mails
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Dieser Ordner enthaelt keine E-Mails.
        </p>
        {lastSyncTime && (
          <p className="text-xs text-muted-foreground/70 mt-2">
            Letzte Synchronisation: {lastSyncTime}
          </p>
        )}
      </div>
    );
  }

  // no-selection: shown in detail pane when no email is selected
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Mail className="w-8 h-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-base font-medium text-foreground mb-1">
        Waehlen Sie eine E-Mail aus
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Klicken Sie auf eine E-Mail in der Liste, um sie hier anzuzeigen.
      </p>
    </div>
  );
}
