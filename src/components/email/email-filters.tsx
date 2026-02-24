"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, X, Filter, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { EmailFiltersState } from "@/hooks/use-email-store";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EmailFiltersProps {
  filters: EmailFiltersState;
  onUpdateFilters: (partial: Partial<EmailFiltersState>) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EmailFilters({ filters, onUpdateFilters }: EmailFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced search (300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdateFilters({ search: searchInput || undefined });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    onUpdateFilters({ search: undefined });
  }, [onUpdateFilters]);

  return (
    <div className="px-3 py-2 space-y-2 border-b border-slate-200 dark:border-slate-700/50">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Suchen..."
          className="pl-8 pr-8 h-8 text-xs"
        />
        {searchInput && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Status filter */}
        <FilterChip
          label="Alle"
          active={filters.veraktet === "alle" || !filters.veraktet}
          onClick={() => onUpdateFilters({ veraktet: "alle" })}
        />
        <FilterChip
          label="Veraktet"
          active={filters.veraktet === "veraktet"}
          onClick={() => onUpdateFilters({ veraktet: "veraktet" })}
        />
        <FilterChip
          label="Unveraktet"
          active={filters.veraktet === "unveraktet"}
          onClick={() => onUpdateFilters({ veraktet: "unveraktet" })}
        />

        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />

        {/* Unread toggle */}
        <FilterChip
          label="Ungelesen"
          active={filters.gelesen === false}
          onClick={() =>
            onUpdateFilters({
              gelesen: filters.gelesen === false ? null : false,
            })
          }
        />

        {/* Sort */}
        <div className="ml-auto flex items-center gap-1">
          <SlidersHorizontal className="w-3 h-3 text-slate-400" />
          <select
            value={filters.sort ?? "empfangenAm"}
            onChange={(e) =>
              onUpdateFilters({
                sort: e.target.value as EmailFiltersState["sort"],
              })
            }
            className="text-xs bg-transparent border-0 text-slate-500 dark:text-slate-400 cursor-pointer focus:outline-none pr-4"
          >
            <option value="empfangenAm">Datum</option>
            <option value="absender">Absender</option>
            <option value="betreff">Betreff</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── FilterChip ─────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors",
        active
          ? "bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300"
          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
      )}
    >
      {label}
    </button>
  );
}
