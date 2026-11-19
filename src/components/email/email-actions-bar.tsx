"use client";

import { useState, useCallback } from "react";
import {
  Reply,
  ReplyAll,
  Forward,
  FolderInput,
  Ticket,
  Archive,
  ShieldBan,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { emailBulkAktion } from "@/lib/email/bulk-contract";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ReplyMode = "reply" | "replyAll" | "forward";

interface EmailActionsBarProps {
  emailId: string;
  isVeraktet: boolean;
  onReplyAction: (mode: ReplyMode) => void;
  onEmailDeleted?: () => void;
  onVerakten?: () => void;
  onTicket?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EmailActionsBar({
  emailId,
  isVeraktet,
  onReplyAction,
  onEmailDeleted,
  onVerakten,
  onTicket,
}: EmailActionsBarProps) {
  const [showVeraktungBanner, setShowVeraktungBanner] = useState(false);

  const handleReplyAction = useCallback(
    (mode: ReplyMode) => {
      // Show veraktung recommendation when replying/forwarding an unveraktete email
      if (!isVeraktet && (mode === "reply" || mode === "replyAll" || mode === "forward")) {
        setShowVeraktungBanner(true);
      }
      onReplyAction(mode);
    },
    [isVeraktet, onReplyAction]
  );

  const runAktion = useCallback(
    async (action: "archive" | "spam", erfolg: string) => {
      try {
        await emailBulkAktion({ action, emailIds: [emailId] });
        toast.success(erfolg);
        onEmailDeleted?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Aktion fehlgeschlagen");
      }
    },
    [emailId, onEmailDeleted]
  );

  const handleArchive = useCallback(() => runAktion("archive", "E-Mail archiviert"), [runAktion]);
  const handleSpam = useCallback(() => runAktion("spam", "Als Spam markiert"), [runAktion]);

  const handleDelete = useCallback(async () => {
    // Soft delete with 5s undo toast (undo = bulk "restore")
    try {
      await emailBulkAktion({ action: "delete", emailIds: [emailId] });
      toast("E-Mail gelöscht", {
        action: {
          label: "Rückgängig",
          onClick: async () => {
            try {
              await emailBulkAktion({ action: "restore", emailIds: [emailId] });
              toast.success("Löschung rückgängig gemacht");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Wiederherstellen fehlgeschlagen");
            }
          },
        },
        duration: 5000,
      });
      onEmailDeleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }, [emailId, onEmailDeleted]);

  return (
    <div className="space-y-2">
      {/* Action buttons */}
      <div className="flex items-center gap-1 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => handleReplyAction("reply")}
        >
          <Reply className="w-4 h-4" />
          Antworten
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => handleReplyAction("replyAll")}
        >
          <ReplyAll className="w-4 h-4" />
          Allen antworten
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => handleReplyAction("forward")}
        >
          <Forward className="w-4 h-4" />
          Weiterleiten
        </Button>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={onVerakten}
        >
          <FolderInput className="w-4 h-4" />
          Verakten
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={onTicket}
        >
          <Ticket className="w-4 h-4" />
          Ticket
        </Button>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={handleArchive}
        >
          <Archive className="w-4 h-4" />
          Archivieren
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={handleSpam}
        >
          <ShieldBan className="w-4 h-4" />
          Spam
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5 text-rose-600 hover:text-rose-700"
          onClick={handleDelete}
        >
          <Trash2 className="w-4 h-4" />
          Löschen
        </Button>
      </div>

      {/* Veraktungs-Empfehlung banner */}
      {showVeraktungBanner && !isVeraktet && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-200 flex-1">
            Diese E-Mail ist nicht veraktet — Jetzt verakten?
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-amber-700 hover:text-amber-800"
            onClick={() => {
              onVerakten?.();
              setShowVeraktungBanner(false);
            }}
          >
            Verakten
          </Button>
          <button
            onClick={() => setShowVeraktungBanner(false)}
            className="text-amber-400 hover:text-amber-600 text-xs"
          >
            Später
          </button>
        </div>
      )}
    </div>
  );
}
