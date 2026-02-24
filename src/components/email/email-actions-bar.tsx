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

  const handleArchive = useCallback(async () => {
    try {
      const res = await fetch("/api/emails/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", emailIds: [emailId] }),
      });
      if (res.ok) {
        toast.success("E-Mail archiviert");
        onEmailDeleted?.();
      }
    } catch {
      toast.error("Fehler beim Archivieren");
    }
  }, [emailId, onEmailDeleted]);

  const handleSpam = useCallback(async () => {
    try {
      const res = await fetch("/api/emails/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "spam", emailIds: [emailId] }),
      });
      if (res.ok) {
        toast.success("Als Spam markiert");
        onEmailDeleted?.();
      }
    } catch {
      toast.error("Fehler beim Spam-Markieren");
    }
  }, [emailId, onEmailDeleted]);

  const handleDelete = useCallback(async () => {
    // Soft delete with 5s undo toast
    try {
      const res = await fetch(`/api/emails/${emailId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast("E-Mail geloescht", {
          action: {
            label: "Rueckgaengig",
            onClick: async () => {
              try {
                await fetch(`/api/emails/${emailId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ geloescht: false }),
                });
                toast.success("Loeschung rueckgaengig gemacht");
              } catch {
                // Ignore
              }
            },
          },
          duration: 5000,
        });
        onEmailDeleted?.();
      }
    } catch {
      toast.error("Fehler beim Loeschen");
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
          Loeschen
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
            Spaeter
          </button>
        </div>
      )}
    </div>
  );
}
