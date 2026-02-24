"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Inbox,
  Send,
  FileEdit,
  Trash2,
  ShieldBan,
  Archive,
  Folder,
  ChevronDown,
  ChevronRight,
  Mail,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EmailKontoFolder {
  id: string;
  name: string;
  pfad: string;
  spezialTyp: string;
  ungeleseneAnzahl: number;
  gesamtAnzahl: number;
  sortierung: number;
}

interface EmailKontoGroup {
  id: string;
  name: string;
  emailAdresse: string;
  istKanzlei: boolean;
  folders: EmailKontoFolder[];
}

interface FolderTreeProps {
  selectedKontoId: string | null;
  selectedOrdnerId: string | null;
  onSelectFolder: (kontoId: string | null, ordnerId: string | null) => void;
}

// ─── Special folder icon mapping ────────────────────────────────────────────

const FOLDER_ICONS: Record<string, React.ElementType> = {
  INBOX: Inbox,
  GESENDET: Send,
  ENTWUERFE: FileEdit,
  PAPIERKORB: Trash2,
  SPAM: ShieldBan,
  ARCHIV: Archive,
  CUSTOM: Folder,
};

const SPECIAL_FOLDER_ORDER = [
  "INBOX",
  "ENTWUERFE",
  "GESENDET",
  "SPAM",
  "PAPIERKORB",
  "ARCHIV",
];

// ─── Component ──────────────────────────────────────────────────────────────

export function FolderTree({
  selectedKontoId,
  selectedOrdnerId,
  onSelectFolder,
}: FolderTreeProps) {
  const [konten, setKonten] = useState<EmailKontoGroup[]>([]);
  const [collapsedKonten, setCollapsedKonten] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFolders = useCallback(async () => {
    try {
      setError(null);
      // Fetch mailboxes and folders in parallel
      const [kontenRes, foldersRes] = await Promise.all([
        fetch("/api/email-konten"),
        fetch("/api/email-folders?kontoId=all"),
      ]);

      if (!kontenRes.ok || !foldersRes.ok) {
        throw new Error("Postfaecher konnten nicht geladen werden");
      }

      const kontenData = await kontenRes.json();
      const foldersData = await foldersRes.json();

      // Group folders by konto
      const groupedKonten: EmailKontoGroup[] = (kontenData.data ?? kontenData)
        .filter((k: any) => k.aktiv !== false)
        .map((konto: any) => ({
          id: konto.id,
          name: konto.name,
          emailAdresse: konto.emailAdresse,
          istKanzlei: konto.istKanzlei,
          folders: sortFolders(
            (foldersData.data ?? foldersData).filter(
              (f: any) => f.kontoId === konto.id
            )
          ),
        }));

      setKonten(groupedKonten);

      // Auto-select first mailbox inbox if nothing selected
      if (!selectedKontoId && groupedKonten.length > 0) {
        const firstKonto = groupedKonten[0];
        const inbox = firstKonto.folders.find(
          (f) => f.spezialTyp === "INBOX"
        );
        if (inbox) {
          onSelectFolder(firstKonto.id, inbox.id);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Fehler beim Laden der Ordner"
      );
    } finally {
      setLoading(false);
    }
  }, [selectedKontoId, onSelectFolder]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  // Socket.IO real-time folder count updates
  useEffect(() => {
    // Listen for folder update events when Socket.IO is available
    const handleFolderUpdate = (event: CustomEvent) => {
      const { ordnerId, ungeleseneAnzahl } = event.detail;
      setKonten((prev) =>
        prev.map((konto) => ({
          ...konto,
          folders: konto.folders.map((f) =>
            f.id === ordnerId ? { ...f, ungeleseneAnzahl } : f
          ),
        }))
      );
    };

    window.addEventListener(
      "email:folder-update" as any,
      handleFolderUpdate as EventListener
    );
    return () => {
      window.removeEventListener(
        "email:folder-update" as any,
        handleFolderUpdate as EventListener
      );
    };
  }, []);

  const toggleKonto = (kontoId: string) => {
    setCollapsedKonten((prev) => {
      const next = new Set(prev);
      if (next.has(kontoId)) next.delete(kontoId);
      else next.add(kontoId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full p-3 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="ml-4 space-y-1.5">
              {[1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
        <p className="text-sm text-muted-foreground mb-3">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            fetchFolders();
          }}
          className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Erneut laden
        </button>
      </div>
    );
  }

  if (konten.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Mail className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">
          Kein E-Mail-Konto eingerichtet
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Ein Administrator muss ein E-Mail-Konto konfigurieren.
        </p>
        <a
          href="/einstellungen"
          className="text-xs text-brand-600 hover:text-brand-700 underline"
        >
          Zu den Einstellungen
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50">
        <h2 className="text-sm font-semibold text-foreground">Postfaecher</h2>
      </div>

      {/* Mailbox folders */}
      <div className="flex-1 overflow-y-auto py-1">
        {konten.map((konto) => {
          const isCollapsed = collapsedKonten.has(konto.id);
          const totalUnread = konto.folders.reduce(
            (sum, f) => sum + f.ungeleseneAnzahl,
            0
          );

          return (
            <div key={konto.id} className="mb-1">
              {/* Mailbox header */}
              <button
                onClick={() => toggleKonto(konto.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span className="truncate flex-1 text-left">
                  {konto.name}
                </span>
                {totalUnread > 0 && (
                  <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-brand-600 text-white text-[10px] font-bold">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </button>

              {/* Folders */}
              {!isCollapsed && (
                <div className="ml-1">
                  {konto.folders.map((folder) => {
                    const isSelected =
                      selectedKontoId === konto.id &&
                      selectedOrdnerId === folder.id;
                    const Icon =
                      FOLDER_ICONS[folder.spezialTyp] || FOLDER_ICONS.CUSTOM;

                    return (
                      <button
                        key={folder.id}
                        onClick={() => onSelectFolder(konto.id, folder.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-4 py-1.5 text-sm transition-colors rounded-r-md mr-1",
                          isSelected
                            ? "bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 font-medium border-l-2 border-brand-600"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border-l-2 border-transparent"
                        )}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate flex-1 text-left">
                          {folder.name}
                        </span>
                        {folder.ungeleseneAnzahl > 0 && (
                          <span
                            className={cn(
                              "flex-shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold",
                              isSelected
                                ? "bg-brand-600 text-white"
                                : "bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300"
                            )}
                          >
                            {folder.ungeleseneAnzahl > 99
                              ? "99+"
                              : folder.ungeleseneAnzahl}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sortFolders(folders: EmailKontoFolder[]): EmailKontoFolder[] {
  return folders.sort((a, b) => {
    const aIndex = SPECIAL_FOLDER_ORDER.indexOf(a.spezialTyp);
    const bIndex = SPECIAL_FOLDER_ORDER.indexOf(b.spezialTyp);

    // Special folders first, in defined order
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;

    // Custom folders alphabetically
    return a.name.localeCompare(b.name, "de");
  });
}
