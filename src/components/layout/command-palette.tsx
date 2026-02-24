"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  FolderOpen,
  Users,
  Calendar,
  FileText,
  Settings,
  Search,
  Plus,
  Loader2,
  Calculator,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const quickActions = [
  {
    group: "Navigation",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: FolderOpen },
      { name: "Akten", href: "/akten", icon: FolderOpen },
      { name: "Kontakte", href: "/kontakte", icon: Users },
      { name: "Kalender", href: "/kalender", icon: Calendar },
      { name: "Dokumente", href: "/dokumente", icon: FileText },
      { name: "Einstellungen", href: "/einstellungen", icon: Settings },
    ],
  },
  {
    group: "Aktionen",
    items: [
      { name: "Neue Akte anlegen", href: "/akten/neu", icon: Plus },
      { name: "Neuen Kontakt anlegen", href: "/kontakte/neu", icon: Plus },
      { name: "Neuen Termin anlegen", href: "/kalender/neu", icon: Plus },
      { name: "Frist berechnen", href: "__fristenrechner__", icon: Calculator },
    ],
  },
];

const statusBadge: Record<string, "success" | "warning" | "muted" | "danger"> = {
  OFFEN: "success",
  RUHEND: "warning",
  ARCHIVIERT: "muted",
  GESCHLOSSEN: "danger",
};

interface SearchResults {
  akten: Array<{
    id: string;
    aktenzeichen: string;
    kurzrubrum: string;
    status: string;
  }>;
  kontakte: Array<{
    id: string;
    vorname: string | null;
    nachname: string | null;
    firma: string | null;
    typ: string;
    email: string | null;
  }>;
  dokumente: Array<{
    id: string;
    akteId: string;
    name: string;
    aktenzeichen: string;
  }>;
}

const emptyResults: SearchResults = { akten: [], kontakte: [], dokumente: [] };

interface CommandPaletteProps {
  onFristenRechner?: () => void;
}

export function CommandPalette({ onFristenRechner }: CommandPaletteProps = {}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResults>(emptyResults);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const resetSearch = useCallback(() => {
    setQuery("");
    setSearchResults(emptyResults);
    setIsSearching(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  function handleClose() {
    setOpen(false);
    resetSearch();
  }

  function handleSelect(href: string) {
    handleClose();
    if (href === "__fristenrechner__") {
      onFristenRechner?.();
      return;
    }
    router.push(href);
  }

  const performSearch = useCallback(async (q: string) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsSearching(true);

    try {
      const [aktenRes, kontakteRes, dokumenteRes] = await Promise.allSettled([
        fetch(`/api/akten?q=${encodeURIComponent(q)}&take=5`, { signal: controller.signal })
          .then((r) => r.json()),
        fetch(`/api/kontakte?q=${encodeURIComponent(q)}&take=5`, { signal: controller.signal })
          .then((r) => r.json()),
        fetch(`/api/dokumente/search?q=${encodeURIComponent(q)}&limit=5`, { signal: controller.signal })
          .then((r) => r.json()),
      ]);

      if (controller.signal.aborted) return;

      setSearchResults({
        akten: aktenRes.status === "fulfilled" ? (aktenRes.value.akten ?? []) : [],
        kontakte: kontakteRes.status === "fulfilled" ? (kontakteRes.value.kontakte ?? []) : [],
        dokumente: dokumenteRes.status === "fulfilled" ? (dokumenteRes.value.hits ?? []) : [],
      });
    } catch {
      // Aborted or network error — ignore
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      if (abortRef.current) abortRef.current.abort();
      setSearchResults(emptyResults);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(() => {
      performSearch(value.trim());
    }, 300);
  }

  const hasQuery = query.trim().length > 0;
  const hasResults =
    searchResults.akten.length > 0 ||
    searchResults.kontakte.length > 0 ||
    searchResults.dokumente.length > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Palette */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
        <Command
          className="glass-lg rounded-xl shadow-2xl overflow-hidden"
          shouldFilter={!hasQuery}
        >
          <div className="flex items-center px-4 border-b border-white/10 dark:border-white/[0.06]">
            <Search className="w-4 h-4 text-muted-foreground mr-3" />
            <Command.Input
              placeholder="Suchen oder Aktion ausführen..."
              className="flex-1 py-3 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              autoFocus
              value={query}
              onValueChange={handleQueryChange}
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin mr-2" />
            )}
            <kbd className="text-xs text-muted-foreground border border-white/20 dark:border-white/10 rounded px-1.5 py-0.5">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {isSearching ? "Suche..." : "Keine Ergebnisse gefunden."}
            </Command.Empty>

            {/* Static navigation — shown when query is empty */}
            {!hasQuery &&
              quickActions.map((group) => (
                <Command.Group
                  key={group.group}
                  heading={group.group}
                  className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
                >
                  {group.items.map((item) => (
                    <Command.Item
                      key={item.href}
                      value={item.name}
                      onSelect={() => handleSelect(item.href)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer text-foreground/80 data-[selected=true]:bg-brand-500/15 data-[selected=true]:text-brand-700 dark:data-[selected=true]:text-brand-300"
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}

            {/* Search results — shown when query is present */}
            {hasQuery && hasResults && (
              <>
                {/* Akten */}
                {searchResults.akten.length > 0 && (
                  <Command.Group
                    heading="Akten"
                    className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
                  >
                    {searchResults.akten.map((akte) => (
                      <Command.Item
                        key={`akte-${akte.id}`}
                        value={`akte-${akte.id}`}
                        onSelect={() => handleSelect(`/akten/${akte.id}`)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer text-foreground/80 data-[selected=true]:bg-brand-500/15 data-[selected=true]:text-brand-700 dark:data-[selected=true]:text-brand-300"
                      >
                        <FolderOpen className="w-4 h-4 shrink-0" />
                        <span className="truncate">
                          <span className="font-mono text-xs">{akte.aktenzeichen}</span>
                          {" — "}
                          {akte.kurzrubrum}
                        </span>
                        <Badge
                          variant={statusBadge[akte.status] ?? "muted"}
                          className="ml-auto shrink-0 text-[10px]"
                        >
                          {akte.status}
                        </Badge>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* Kontakte */}
                {searchResults.kontakte.length > 0 && (
                  <Command.Group
                    heading="Kontakte"
                    className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
                  >
                    {searchResults.kontakte.map((kontakt) => {
                      const displayName =
                        kontakt.vorname || kontakt.nachname
                          ? [kontakt.vorname, kontakt.nachname].filter(Boolean).join(" ")
                          : kontakt.firma ?? "Unbekannt";
                      const typLabel = kontakt.typ === "JURISTISCH" ? "Firma" : "Person";

                      return (
                        <Command.Item
                          key={`kontakt-${kontakt.id}`}
                          value={`kontakt-${kontakt.id}`}
                          onSelect={() => handleSelect(`/kontakte/${kontakt.id}`)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer text-foreground/80 data-[selected=true]:bg-brand-500/15 data-[selected=true]:text-brand-700 dark:data-[selected=true]:text-brand-300"
                        >
                          <Users className="w-4 h-4 shrink-0" />
                          <span className="truncate">{displayName}</span>
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                            {typLabel}
                            {kontakt.email && ` · ${kontakt.email}`}
                          </span>
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                )}

                {/* Dokumente */}
                {searchResults.dokumente.length > 0 && (
                  <Command.Group
                    heading="Dokumente"
                    className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
                  >
                    {searchResults.dokumente.map((doc) => (
                      <Command.Item
                        key={`doc-${doc.id}`}
                        value={`doc-${doc.id}`}
                        onSelect={() => handleSelect(`/akten/${doc.akteId}`)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer text-foreground/80 data-[selected=true]:bg-brand-500/15 data-[selected=true]:text-brand-700 dark:data-[selected=true]:text-brand-300"
                      >
                        <FileText className="w-4 h-4 shrink-0" />
                        <span className="truncate">{doc.name}</span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground font-mono">
                          {doc.aktenzeichen}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
