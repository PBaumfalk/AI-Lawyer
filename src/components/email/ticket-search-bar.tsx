"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface TicketSearchBarProps {
  defaultSearch?: string;
  defaultStatus?: string;
  defaultPrioritaet?: string;
  defaultTag?: string;
}

export function TicketSearchBar({
  defaultSearch,
  defaultStatus,
  defaultPrioritaet,
  defaultTag,
}: TicketSearchBarProps) {
  const router = useRouter();
  const [search, setSearch] = useState(defaultSearch ?? "");

  const updateUrl = useCallback(
    (q: string, status: string, prioritaet: string, tag: string) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (prioritaet) params.set("prioritaet", prioritaet);
      if (tag) params.set("tag", tag);
      const query = params.toString();
      router.push(`/email/tickets${query ? `?${query}` : ""}`);
    },
    [router]
  );

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateUrl(search, defaultStatus ?? "", defaultPrioritaet ?? "", defaultTag ?? "");
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateUrl(search, e.target.value, defaultPrioritaet ?? "", defaultTag ?? "");
  }

  function handlePrioritaetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateUrl(search, defaultStatus ?? "", e.target.value, defaultTag ?? "");
  }

  function handleTagChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateUrl(search, defaultStatus ?? "", defaultPrioritaet ?? "", e.target.value);
  }

  function handleClear() {
    setSearch("");
    updateUrl("", defaultStatus ?? "", defaultPrioritaet ?? "", defaultTag ?? "");
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
            placeholder="Ticket-Titel oder Beschreibung suchen..."
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
      </form>
    </div>
  );
}
