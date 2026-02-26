"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface AktenSearchBarProps {
  defaultSearch?: string;
  defaultStatus?: string;
}

export function AktenSearchBar({
  defaultSearch,
  defaultStatus,
}: AktenSearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(defaultSearch ?? "");

  const updateUrl = useCallback(
    (q: string, status: string) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      const query = params.toString();
      router.push(`/akten${query ? `?${query}` : ""}`);
    },
    [router]
  );

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateUrl(search, defaultStatus ?? "");
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateUrl(search, e.target.value);
  }

  function handleClear() {
    setSearch("");
    updateUrl("", defaultStatus ?? "");
  }

  return (
    <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
      <div className="relative max-w-md flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Aktenzeichen, Rubrum oder Beteiligte suchen..."
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
        className="w-40"
      >
        <option value="">Alle Status</option>
        <option value="OFFEN">Offen</option>
        <option value="RUHEND">Ruhend</option>
        <option value="ARCHIVIERT">Archiviert</option>
        <option value="GESCHLOSSEN">Geschlossen</option>
      </Select>
    </form>
  );
}
