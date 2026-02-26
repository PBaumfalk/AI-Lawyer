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

interface KiEntwuerfeSearchBarProps {
  defaultSearch?: string;
  defaultAkteId?: string;
  defaultDatum?: string;
  akten?: AkteOption[];
}

export function KiEntwuerfeSearchBar({
  defaultSearch,
  defaultAkteId,
  defaultDatum,
  akten,
}: KiEntwuerfeSearchBarProps) {
  const router = useRouter();
  const [search, setSearch] = useState(defaultSearch ?? "");

  const updateUrl = useCallback(
    (params: Record<string, string>) => {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v) sp.set(k, v);
      }
      const query = sp.toString();
      router.push(`/ki-entwuerfe${query ? `?${query}` : ""}`);
    },
    [router]
  );

  function allParams(overrides: Record<string, string> = {}) {
    return {
      q: search,
      akteId: defaultAkteId ?? "",
      datum: defaultDatum ?? "",
      ...overrides,
    };
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateUrl(allParams({ q: search }));
  }

  function handleAkteChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateUrl(allParams({ akteId: e.target.value }));
  }

  function handleDatumChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateUrl(allParams({ datum: e.target.value }));
  }

  function handleClear() {
    setSearch("");
    updateUrl(allParams({ q: "" }));
  }

  return (
    <form
      onSubmit={handleSearchSubmit}
      className="flex items-center gap-3 flex-wrap"
    >
      <div className="relative max-w-md flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Entwurf suchen..."
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
        value={defaultDatum ?? ""}
        onChange={handleDatumChange}
        className="w-48"
      >
        <option value="">Alle Zeiträume</option>
        <option value="heute">Heute</option>
        <option value="7tage">Letzte 7 Tage</option>
        <option value="30tage">Letzte 30 Tage</option>
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
    </form>
  );
}
