"use client";

import { useState } from "react";
import {
  FileText,
  AlertTriangle,
  Mail,
  Bot,
  Bell,
  StickyNote,
  UserPlus,
  ArrowRightLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Check,
  Pencil,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Feed entry data shape (from API response)
export interface FeedEntryData {
  id: string;
  akteId: string;
  typ: string; // AktenActivityTyp
  titel: string;
  inhalt: string | null;
  meta: Record<string, any> | null;
  createdAt: string;
  user: { id: string; name: string } | null; // null = Helena
}

interface ActivityFeedEntryProps {
  entry: FeedEntryData;
}

// Icon mapping per activity type
const typIcons: Record<string, React.ElementType> = {
  DOKUMENT: FileText,
  FRIST: AlertTriangle,
  EMAIL: Mail,
  HELENA_DRAFT: Bot,
  HELENA_ALERT: Bell,
  NOTIZ: StickyNote,
  BETEILIGTE: UserPlus,
  STATUS_CHANGE: ArrowRightLeft,
};

// Severity-based left border color for Helena alerts
function severityBorderClass(severity?: number): string {
  if (!severity) return "border-l-2 border-l-amber-500";
  if (severity >= 7) return "border-l-2 border-l-rose-500";
  if (severity >= 4) return "border-l-2 border-l-amber-500";
  return "border-l-2 border-l-emerald-500";
}

// MIME type → human-readable file type label
const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word-Dokument",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel-Tabelle",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "application/msword": "Word-Dokument",
  "application/vnd.ms-excel": "Excel-Tabelle",
  "application/vnd.ms-powerpoint": "PowerPoint",
  "application/zip": "ZIP-Archiv",
  "image/jpeg": "JPEG-Bild",
  "image/png": "PNG-Bild",
  "image/gif": "GIF-Bild",
  "image/webp": "WebP-Bild",
  "image/tiff": "TIFF-Bild",
  "text/plain": "Textdatei",
  "text/html": "HTML-Dokument",
  "text/csv": "CSV-Datei",
  "application/rtf": "RTF-Dokument",
  "application/octet-stream": "Datei",
};

function mimeToLabel(mime: string): string {
  return MIME_LABELS[mime.toLowerCase().trim()] ?? "Dokument";
}

// Sanitize technically-formatted text into human-readable form
function sanitizeTitel(titel: string): string {
  // "mimeType: application/vnd...." or "mimeType:application/pdf"
  const mimeMatch = titel.match(/^mimeType\s*:\s*(\S+)/i);
  if (mimeMatch) {
    return `${mimeToLabel(mimeMatch[1])} hochgeladen`;
  }

  // UUID chains like "xxx → yyy" where xxx/yyy look like cuid/uuid
  // Replace with nothing (keep surrounding text)
  const cleaned = titel.replace(/[a-z0-9]{20,}/gi, (match) => {
    // Only strip if it looks like a pure ID (no spaces, mostly hex/alphanumeric)
    if (/^[a-z0-9]{20,}$/i.test(match)) return "[ID]";
    return match;
  });

  return cleaned !== titel ? cleaned : titel;
}

// Sanitize inhalt for display (strip raw mimeType lines, etc.)
function sanitizeInhalt(inhalt: string | null): string | null {
  if (!inhalt) return null;
  // Remove lines that are purely "mimeType: ..."
  const lines = inhalt.split("\n").filter((l) => !/^mimeType\s*:/i.test(l.trim()));
  return lines.join("\n").trim() || null;
}

// German relative time formatting
function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} Tagen`;
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Link target for expanded entry navigation
function getDeepLink(entry: FeedEntryData): string | null {
  switch (entry.typ) {
    case "DOKUMENT":
      return `/akten/${entry.akteId}?tab=dokumente`;
    case "FRIST":
      return `/akten/${entry.akteId}?tab=kalender`;
    default:
      return null;
  }
}

export function ActivityFeedEntry({ entry }: ActivityFeedEntryProps) {
  const [expanded, setExpanded] = useState(false);
  const [draftStatus, setDraftStatus] = useState<string | null>(
    entry.meta?.draftStatus ?? null
  );

  const isHelena = entry.user === null;
  const Icon = typIcons[entry.typ] ?? FileText;

  // Sanitized display values
  const displayTitel = sanitizeTitel(entry.titel);
  const displayInhalt = sanitizeInhalt(entry.inhalt);

  // Border styling based on Helena vs Human and entry type
  const borderClass = isHelena
    ? entry.typ === "HELENA_ALERT"
      ? severityBorderClass(entry.meta?.severity)
      : entry.typ === "HELENA_DRAFT"
        ? "border-l-2 border-l-[oklch(45%_0.2_260)]"
        : ""
    : "";

  const deepLink = getDeepLink(entry);

  return (
    <div className={cn("glass-card rounded-xl overflow-hidden", borderClass)}>
      {/* Header -- always visible, clickable to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/20 dark:hover:bg-white/[0.03] transition-colors"
      >
        {/* Expand indicator */}
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}

        {/* Type icon */}
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            isHelena
              ? "bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          )}
        >
          <Icon className="w-4 h-4" />
        </div>

        {/* Title + attribution */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {displayTitel}
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {isHelena ? (
              <span className="flex items-center gap-1">
                <Bot className="w-3 h-3" />
                Helena
              </span>
            ) : (
              <span>{entry.user?.name ?? "System"}</span>
            )}
            <span>&middot;</span>
            <span>{relativeTime(entry.createdAt)}</span>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800">
          <ExpandedContent entry={{ ...entry, inhalt: displayInhalt }} />

          {/* Source display for Helena draft entries */}
          {entry.typ === "HELENA_DRAFT" && <SourceDisplay entry={entry} />}

          {/* Inline draft review for HELENA_DRAFT with PENDING status */}
          {entry.typ === "HELENA_DRAFT" && draftStatus === "PENDING" && (
            <DraftReviewActions
              entry={entry}
              onStatusChange={setDraftStatus}
            />
          )}

          {/* Status badge for non-pending drafts */}
          {entry.typ === "HELENA_DRAFT" &&
            draftStatus &&
            draftStatus !== "PENDING" && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <span
                  className={cn(
                    "text-xs px-2 py-1 rounded-full",
                    draftStatus === "ACCEPTED"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                      : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                  )}
                >
                  {draftStatus === "ACCEPTED" ? "Angenommen" : "Abgelehnt"}
                </span>
              </div>
            )}

          {/* Deep link to relevant tab */}
          {deepLink && (
            <a
              href={deepLink}
              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline mt-3"
            >
              <ExternalLink className="w-3 h-3" />
              Details anzeigen
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// Inline draft review actions (Accept/Edit/Reject)
function DraftReviewActions({
  entry,
  onStatusChange,
}: {
  entry: FeedEntryData;
  onStatusChange: (status: string) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [editText, setEditText] = useState(entry.inhalt ?? "");
  const [rejectFeedback, setRejectFeedback] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const draftId = entry.meta?.draftId;
  if (!draftId) return null;

  async function handleAccept() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/helena/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Entwurf angenommen");
      onStatusChange("ACCEPTED");
    } catch {
      toast.error("Fehler beim Annehmen");
    }
    setActionLoading(false);
  }

  async function handleReject() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/helena/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", text: rejectFeedback || undefined }),
      });
      if (!res.ok) throw new Error();
      toast.success("Entwurf abgelehnt");
      onStatusChange("REJECTED");
      setRejectMode(false);
    } catch {
      toast.error("Fehler beim Ablehnen");
    }
    setActionLoading(false);
  }

  async function handleSaveEdit() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/helena/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit", inhalt: editText }),
      });
      if (!res.ok) throw new Error();
      toast.success("Entwurf bearbeitet");
      setEditMode(false);
    } catch {
      toast.error("Fehler beim Speichern");
    }
    setActionLoading(false);
  }

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
      {editMode ? (
        <div className="w-full space-y-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 resize-none"
            rows={4}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : null}
              Speichern
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditMode(false)}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      ) : rejectMode ? (
        <div className="w-full space-y-2">
          <textarea
            value={rejectFeedback}
            onChange={(e) => setRejectFeedback(e.target.value)}
            placeholder="Feedback (optional)..."
            className="w-full p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 resize-none"
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : null}
              Ablehnen
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRejectMode(false)}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleAccept}
            disabled={actionLoading}
          >
            <Check className="w-3.5 h-3.5 mr-1" /> Annehmen
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditMode(true)}
          >
            <Pencil className="w-3.5 h-3.5 mr-1" /> Bearbeiten
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRejectMode(true)}
          >
            <X className="w-3.5 h-3.5 mr-1" /> Ablehnen
          </Button>
        </>
      )}
    </div>
  );
}

// Collapsible source display for Helena draft entries
function SourceDisplay({ entry }: { entry: FeedEntryData }) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  const belege: any[] =
    entry.meta?.retrieval_belege ?? entry.meta?.retrievalBelege ?? [];
  if (belege.length === 0) return null;

  const normenCount = belege.filter(
    (b: any) => b.quelle === "gesetz"
  ).length;
  const urteileCount = belege.filter(
    (b: any) => b.quelle === "urteil"
  ).length;
  const musterCount = belege.filter(
    (b: any) => b.quelle === "muster"
  ).length;

  return (
    <div className="mt-3">
      <button
        onClick={() => setSourcesExpanded(!sourcesExpanded)}
        className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
      >
        <ChevronRight
          className={cn(
            "w-3 h-3 transition-transform",
            sourcesExpanded && "rotate-90"
          )}
        />
        Quellen: {normenCount} Normen, {urteileCount} Urteile, {musterCount}{" "}
        Muster
      </button>
      {sourcesExpanded && (
        <div className="mt-2 pl-4 space-y-1 text-xs text-slate-600 dark:text-slate-400">
          {belege.map((b: any, i: number) => (
            <div key={i} className="flex items-baseline gap-2">
              <span className="font-medium">{b.referenz}</span>
              <span className="text-slate-400 truncate max-w-md">
                {b.auszug?.slice(0, 100)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Render expanded content based on entry type
function ExpandedContent({ entry }: { entry: FeedEntryData }) {
  const meta = entry.meta;

  switch (entry.typ) {
    case "DOKUMENT":
      return (
        <div className="text-sm text-foreground/80">
          {entry.inhalt && <p>{entry.inhalt}</p>}
          {meta?.dokumentName && (
            <p className="text-xs text-slate-500 mt-1">
              Datei: {meta.dokumentName}
            </p>
          )}
        </div>
      );

    case "FRIST":
      return (
        <div className="text-sm text-foreground/80">
          {entry.inhalt && <p>{entry.inhalt}</p>}
          {meta?.datum && (
            <p className="text-xs text-slate-500 mt-1">
              Faellig: {new Date(meta.datum).toLocaleDateString("de-DE")}
            </p>
          )}
        </div>
      );

    case "EMAIL":
      return (
        <div className="text-sm text-foreground/80">
          {meta?.betreff && (
            <p className="font-medium text-xs">{meta.betreff}</p>
          )}
          {entry.inhalt && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-3">
              {entry.inhalt}
            </p>
          )}
        </div>
      );

    case "HELENA_DRAFT":
      return (
        <div className="text-sm text-foreground/80">
          {entry.inhalt && (
            <p className="whitespace-pre-wrap line-clamp-5">{entry.inhalt}</p>
          )}
          {meta?.schriftsatzTyp && (
            <p className="text-xs text-slate-500 mt-1">
              Typ: {meta.schriftsatzTyp}
            </p>
          )}
        </div>
      );

    case "HELENA_ALERT":
      return (
        <div className="text-sm text-foreground/80">
          {entry.inhalt && <p>{entry.inhalt}</p>}
          {meta?.severity && (
            <p className="text-xs text-slate-500 mt-1">
              Schweregrad: {meta.severity}/10
            </p>
          )}
          {meta?.empfehlung && (
            <p className="text-xs text-slate-500 mt-1">
              Empfehlung: {meta.empfehlung}
            </p>
          )}
        </div>
      );

    case "NOTIZ":
      return (
        <div className="text-sm text-foreground/80">
          {entry.inhalt && (
            <p className="whitespace-pre-wrap">{entry.inhalt}</p>
          )}
        </div>
      );

    case "BETEILIGTE":
      return (
        <div className="text-sm text-foreground/80">
          {entry.inhalt && <p>{entry.inhalt}</p>}
          {meta?.kontaktName && (
            <p className="text-xs text-slate-500 mt-1">
              Kontakt: {meta.kontaktName}
              {meta?.rolle && ` (${meta.rolle})`}
            </p>
          )}
        </div>
      );

    case "STATUS_CHANGE":
      return (
        <div className="text-sm text-foreground/80">
          {meta?.alt && meta?.neu && (
            <p className="text-xs">
              <span className="text-slate-400 line-through">{meta.alt}</span>
              <span className="text-slate-400 mx-2">&rarr;</span>
              <span className="text-foreground">{meta.neu}</span>
            </p>
          )}
          {entry.inhalt && !meta?.alt && <p>{entry.inhalt}</p>}
        </div>
      );

    default:
      return entry.inhalt ? (
        <p className="text-sm text-foreground/80">{entry.inhalt}</p>
      ) : null;
  }
}
