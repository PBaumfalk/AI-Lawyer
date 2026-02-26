"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface EmailSearchBarProps {
  defaultSearch?: string;
  defaultFilter?: string;
  defaultRichtung?: string;
}

export function EmailSearchBar({
  defaultSearch,
  defaultFilter,
  defaultRichtung,
}: EmailSearchBarProps) {
  const router = useRouter();
  const [search, setSearch] = useState(defaultSearch ?? "");

  const updateUrl = useCallback(
    (q: string, filter: string, richtung: string) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (filter) params.set("filter", filter);
      if (richtung) params.set("richtung", richtung);
      const query = params.toString();
      router.push(`/email${query ? `?${query}` : ""}`);
    },
    [router]
  );

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateUrl(search, defaultFilter ?? "", defaultRichtung ?? "");
  }

  function handleFilterChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateUrl(search, e.target.value, defaultRichtung ?? "");
  }

  function handleRichtungChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateUrl(search, defaultFilter ?? "", e.target.value);
  }

  function handleClear() {
    setSearch("");
    updateUrl("", defaultFilter ?? "", defaultRichtung ?? "");
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-md flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Betreff, Absender oder Empfänger suchen..."
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
          value={defaultFilter ?? ""}
          onChange={handleFilterChange}
          className="w-48"
        >
          <option value="">Alle E-Mails</option>
          <option value="ungelesen">Ungelesen</option>
          <option value="unveraktet">Unveraktet</option>
          <option value="veraktet">Veraktet</option>
        </Select>
        <Select
          value={defaultRichtung ?? ""}
          onChange={handleRichtungChange}
          className="w-48"
        >
          <option value="">Alle Richtungen</option>
          <option value="EINGEHEND">Eingehend</option>
          <option value="AUSGEHEND">Ausgehend</option>
        </Select>
      </form>
    </div>
  );
}
