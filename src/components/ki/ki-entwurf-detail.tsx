"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Bot,
  FolderOpen,
  FileText,
  Clock,
  FileDown,
  StickyNote,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface EntwurfData {
  id: string;
  akteId: string;
  nachricht: string;
  bezugDokumentId: string | null;
  createdAt: string;
  akte: { id: string; aktenzeichen: string; kurzrubrum: string | null };
  bezugDokument: { id: string; name: string } | null;
}

interface KiEntwurfDetailProps {
  entwurf: EntwurfData;
}

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function KiEntwurfDetail({ entwurf }: KiEntwurfDetailProps) {
  const router = useRouter();
  const [savingDoc, setSavingDoc] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  async function handleSaveAsDocument() {
    setSavingDoc(true);
    try {
      const res = await fetch("/api/dokumente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          akteId: entwurf.akteId,
          name: `KI-Entwurf vom ${new Date(entwurf.createdAt).toLocaleDateString("de-DE")}`,
          inhalt: entwurf.nachricht,
          status: "ENTWURF",
          ordner: "KI-Entwürfe",
          tags: ["ki-entwurf"],
        }),
      });

      if (res.ok) {
        toast.success("Als Dokument-Entwurf gespeichert.");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Fehler beim Speichern.");
      }
    } catch {
      toast.error("Netzwerkfehler.");
    } finally {
      setSavingDoc(false);
    }
  }

  async function handleSaveAsNote() {
    setSavingNote(true);
    try {
      const res = await fetch("/api/dokumente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          akteId: entwurf.akteId,
          name: `Aktennotiz (KI) vom ${new Date(entwurf.createdAt).toLocaleDateString("de-DE")}`,
          inhalt: entwurf.nachricht,
          status: "ENTWURF",
          ordner: "Aktennotizen",
          tags: ["ki-entwurf", "aktennotiz"],
        }),
      });

      if (res.ok) {
        toast.success("Als Aktennotiz gespeichert.");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Fehler beim Speichern.");
      }
    } catch {
      toast.error("Netzwerkfehler.");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/ki-entwuerfe"
          className="p-2 rounded-lg hover:bg-white/20 dark:hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-heading text-foreground">
            KI-Entwurf
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Erstellt am {formatDateLong(entwurf.createdAt)}
          </p>
        </div>
      </div>

      {/* Labels */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400">
          <Bot className="w-3 h-3 mr-1" />
          KI-generiert
        </Badge>
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          nicht freigegeben
        </Badge>
      </div>

      {/* Metadata */}
      <div className="glass rounded-xl p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
              Akte
            </span>
            <Link
              href={`/akten/${entwurf.akte.id}`}
              className="flex items-center gap-1.5 text-brand-600 hover:underline"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              {entwurf.akte.aktenzeichen}
              {entwurf.akte.kurzrubrum && ` – ${entwurf.akte.kurzrubrum}`}
            </Link>
          </div>

          {entwurf.bezugDokument && (
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                Bezugsdokument
              </span>
              <span className="flex items-center gap-1.5 text-foreground/80">
                <FileText className="w-3.5 h-3.5" />
                {entwurf.bezugDokument.name}
              </span>
            </div>
          )}

          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
              Erstellt
            </span>
            <span className="flex items-center gap-1.5 text-foreground/80">
              <Clock className="w-3.5 h-3.5" />
              {formatDateLong(entwurf.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Inhalt
        </h2>
        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {entwurf.nachricht}
        </div>
      </div>

      {/* Actions */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Aktionen
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handleSaveAsDocument} disabled={savingDoc}>
            {savingDoc ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4 mr-2" />
            )}
            Als Dokument ENTWURF anlegen
          </Button>
          <Button variant="outline" onClick={handleSaveAsNote} disabled={savingNote}>
            {savingNote ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <StickyNote className="w-4 h-4 mr-2" />
            )}
            Als Aktennotiz speichern
          </Button>
        </div>
      </div>
    </div>
  );
}
