"use client";

import { useCallback, useEffect, useState } from "react";
import type { BiFilterParams } from "@/lib/bi/types";
import { GlassCard } from "@/components/ui/glass-card";
import { Select } from "@/components/ui/select";

const SACHGEBIET_OPTIONS = [
  { value: "", label: "Alle Sachgebiete" },
  { value: "ARBEITSRECHT", label: "Arbeitsrecht" },
  { value: "FAMILIENRECHT", label: "Familienrecht" },
  { value: "VERKEHRSRECHT", label: "Verkehrsrecht" },
  { value: "MIETRECHT", label: "Mietrecht" },
  { value: "STRAFRECHT", label: "Strafrecht" },
  { value: "ERBRECHT", label: "Erbrecht" },
  { value: "SOZIALRECHT", label: "Sozialrecht" },
  { value: "INKASSO", label: "Inkasso" },
  { value: "HANDELSRECHT", label: "Handelsrecht" },
  { value: "VERWALTUNGSRECHT", label: "Verwaltungsrecht" },
  { value: "SONSTIGES", label: "Sonstiges" },
] as const;

const ZEITRAUM_OPTIONS = [
  { value: "monat", label: "Monat" },
  { value: "quartal", label: "Quartal" },
  { value: "jahr", label: "Jahr" },
  { value: "custom", label: "Benutzerdefiniert" },
] as const;

interface AnwaltOption {
  id: string;
  name: string;
}

interface BiFiltersProps {
  filters: BiFilterParams;
  onChange: (filters: BiFilterParams) => void;
}

export function BiFilters({ filters, onChange }: BiFiltersProps) {
  const [anwaelte, setAnwaelte] = useState<AnwaltOption[]>([]);

  // Fetch users with ANWALT/PARTNER role for the Anwalt dropdown
  useEffect(() => {
    async function fetchAnwaelte() {
      try {
        const res = await fetch("/api/admin/users?role=ANWALT,PARTNER");
        if (res.ok) {
          const data = await res.json();
          const users = (data.users ?? data ?? []) as Array<{
            id: string;
            name?: string | null;
            email?: string;
          }>;
          setAnwaelte(
            users.map((u) => ({
              id: u.id,
              name: u.name ?? u.email ?? u.id,
            }))
          );
        }
      } catch {
        // Non-critical -- dropdown will show only "Alle"
      }
    }
    fetchAnwaelte();
  }, []);

  const handleChange = useCallback(
    (key: keyof BiFilterParams, value: string) => {
      const updated = { ...filters, [key]: value || undefined };
      // Clear custom date range when switching away from custom
      if (key === "zeitraum" && value !== "custom") {
        delete updated.von;
        delete updated.bis;
      }
      onChange(updated);
    },
    [filters, onChange]
  );

  return (
    <GlassCard className="p-4">
      <div className="flex flex-wrap items-end gap-4">
        {/* Zeitraum */}
        <div className="flex flex-col gap-1.5 min-w-[160px]">
          <label className="text-xs font-medium text-muted-foreground">
            Zeitraum
          </label>
          <Select
            value={filters.zeitraum}
            onChange={(e) => handleChange("zeitraum", e.target.value)}
          >
            {ZEITRAUM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Custom date range */}
        {filters.zeitraum === "custom" && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Von
              </label>
              <input
                type="date"
                value={filters.von ?? ""}
                onChange={(e) => handleChange("von", e.target.value)}
                className="flex h-10 rounded-lg glass-input px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(45%_0.2_260)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Bis
              </label>
              <input
                type="date"
                value={filters.bis ?? ""}
                onChange={(e) => handleChange("bis", e.target.value)}
                className="flex h-10 rounded-lg glass-input px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(45%_0.2_260)]"
              />
            </div>
          </>
        )}

        {/* Anwalt */}
        <div className="flex flex-col gap-1.5 min-w-[180px]">
          <label className="text-xs font-medium text-muted-foreground">
            Anwalt
          </label>
          <Select
            value={filters.anwaltId ?? ""}
            onChange={(e) => handleChange("anwaltId", e.target.value)}
          >
            <option value="">Alle Anwaelte</option>
            {anwaelte.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Sachgebiet */}
        <div className="flex flex-col gap-1.5 min-w-[180px]">
          <label className="text-xs font-medium text-muted-foreground">
            Sachgebiet
          </label>
          <Select
            value={filters.sachgebiet ?? ""}
            onChange={(e) => handleChange("sachgebiet", e.target.value)}
          >
            {SACHGEBIET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </GlassCard>
  );
}
