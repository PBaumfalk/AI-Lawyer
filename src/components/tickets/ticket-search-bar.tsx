"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface AkteOption {
  id: string;
  aktenzeichen: string;
}

interface TicketSearchBarProps {
  basePath?: string;
  defaultSearch?: string;
  defaultStatus?: string;
  defaultPrioritaet?: string;
  defaultTag?: string;
  defaultFaelligkeit?: string;
  defaultAkteId?: string;
  defaultSort?: string;
  akten?: AkteOption[];
}

export function TicketSearchBar({
  basePath = "/tickets",
  defaultSearch,
  defaultStatus,
  defaultPrioritaet,
  defaultTag,
  defaultFaelligkeit,
  defaultAkteId,
  defaultSort,
  akten,
}: TicketSearchBarProps) {
  const router = useRouter();
  const [search, setSearch] = useState(defaultSearch ?? "");

  const updateUrl = useCallback(
    (params: Record<string, string>) => {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v) sp.set(k, v);
      }
      const query = sp.toString();
      router.push(`${basePath}${query ? `?${query}` : ""}`);
    },
    [router, basePath]
  );

  function allParams(overrides: Record<string, string> = {}) {
    return {
      q: search,
      status: defaultStatus ?? "",
      prioritaet: defaultPrioritaet ?? "",
      tag: defaultTag ?? "",
      faelligkeit: defaultFaelligkeit ?? "",
      akteId: defaultAkteId ?? "",
      sort: defaultSort ?? "",
      ...overrides,
    };
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateUrl(allParams({ q: search }));
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateUrl(allParams({ status: e.target.value }));
  }

  function handlePrioritaetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateUrl(allParams({ prioritaet: e.target.value }));
  }

  function handleTagChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateUrl(allParams({ tag: e.target.value }));
  }

  function handleFaelligkeitChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateUrl(allParams({ faelligkeit: e.target.value }));
  }

  function handleAkteChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateUrl(allParams({ akteId: e.target.value }));
  }

  function handleSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateUrl(allParams({ sort: e.target.value }));
  }

  function handleClear() {
    setSearch("");
    updateUrl(allParams({ q: "" }));
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={handleSearchSubmit}
        className="flex items-center gap-3 flex-wrap"
      >
        <div className="relative max-w-md flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ticket suchen..."
            className="pl-10 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Select
          value={defaultStatus ?? ""}
          onChange={handleStatusChange}
          className="w-48"
        >
          <option value="">Alle Status</option>
          <option value="OFFEN">Offen</option>
          <option value="IN_BEARBEITUNG">In Bearbeitung</option>
          <option value="ERLEDIGT">Erledigt</option>
        </Select>
        <Select
          value={defaultPrioritaet ?? ""}
          onChange={handlePrioritaetChange}
          className="w-48"
        >
          <option value="">Alle Prioritäten</option>
          <option value="NIEDRIG">Niedrig</option>
          <option value="NORMAL">Normal</option>
          <option value="HOCH">Hoch</option>
          <option value="KRITISCH">Kritisch</option>
        </Select>
        <Select
          value={defaultFaelligkeit ?? ""}
          onChange={handleFaelligkeitChange}
          className="w-48"
        >
          <option value="">Alle Fälligkeiten</option>
          <option value="heute">Heute fällig</option>
          <option value="ueberfaellig">Überfällig</option>
          <option value="7tage">Nächste 7 Tage</option>
        </Select>
        {akten && akten.length > 0 && (
          <Select
            value={defaultAkteId ?? ""}
            onChange={handleAkteChange}
            className="w-48"
          >
            <option value="">Alle Akten</option>
            {akten.map((a) => (
              <option key={a.id} value={a.id}>
                {a.aktenzeichen}
              </option>
            ))}
          </Select>
        )}
        <Select
          value={defaultTag ?? ""}
          onChange={handleTagChange}
          className="w-48"
        >
          <option value="">Alle Tags</option>
          <option value="ai:summary">KI: Zusammenfassung</option>
          <option value="ai:draft">KI: Entwurf</option>
          <option value="ai:auto">KI: Automatisch</option>
          <option value="ai:done">KI: Erledigt</option>
        </Select>
        <Select
          value={defaultSort ?? ""}
          onChange={handleSortChange}
          className="w-48"
        >
          <option value="">Standard-Sortierung</option>
          <option value="faelligkeit">Fälligkeit</option>
          <option value="prioritaet">Priorität</option>
          <option value="aktualisiert">Zuletzt geändert</option>
        </Select>
      </form>
    </div>
  );
}
