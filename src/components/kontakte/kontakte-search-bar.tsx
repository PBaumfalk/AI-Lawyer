"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface KontakteSearchBarProps {
  defaultSearch?: string;
  defaultTyp?: string;
  defaultTag?: string;
  availableTags?: string[];
}

export function KontakteSearchBar({
  defaultSearch,
  defaultTyp,
  defaultTag,
  availableTags = [],
}: KontakteSearchBarProps) {
  const router = useRouter();
  const [search, setSearch] = useState(defaultSearch ?? "");

  const updateUrl = useCallback(
    (q: string, typ: string, tag: string) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (typ) params.set("typ", typ);
      if (tag) params.set("tag", tag);
      const query = params.toString();
      router.push(`/kontakte${query ? `?${query}` : ""}`);
    },
    [router]
  );

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateUrl(search, defaultTyp ?? "", defaultTag ?? "");
  }

  function handleTypChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateUrl(search, e.target.value, defaultTag ?? "");
  }

  function handleTagClick(tag: string) {
    updateUrl(search, defaultTyp ?? "", defaultTag === tag ? "" : tag);
  }

  function handleClear() {
    setSearch("");
    updateUrl("", defaultTyp ?? "", defaultTag ?? "");
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, Firma, E-Mail oder Ort suchen..."
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
          value={defaultTyp ?? ""}
          onChange={handleTypChange}
          className="w-48"
        >
          <option value="">Alle Typen</option>
          <option value="NATUERLICH">Natürliche Personen</option>
          <option value="JURISTISCH">Juristische Personen</option>
        </Select>
      </form>

      {/* Tag filter chips */}
      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {availableTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className="focus:outline-none"
            >
              <Badge
                variant={defaultTag === tag ? "default" : "muted"}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              >
                {tag}
                {defaultTag === tag && <X className="w-3 h-3 ml-1" />}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
