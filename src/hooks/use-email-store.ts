"use client";

import { useState, useCallback, useEffect } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmailFiltersState {
  gelesen?: boolean | null; // null = all, true = read, false = unread
  veraktet?: "alle" | "veraktet" | "unveraktet";
  akteId?: string;
  verantwortlichId?: string;
  search?: string;
  sort?: "empfangenAm" | "absender" | "betreff" | "akte";
  sortOrder?: "asc" | "desc";
}

export interface EmailStoreState {
  selectedKontoId: string | null;
  selectedOrdnerId: string | null;
  selectedEmailId: string | null;
  filters: EmailFiltersState;
  checkedEmailIds: Set<string>;
}

export interface EmailStoreActions {
  selectFolder: (kontoId: string | null, ordnerId: string | null) => void;
  selectEmail: (emailId: string | null) => void;
  toggleCheck: (emailId: string) => void;
  toggleCheckRange: (fromId: string, toId: string, emailIds: string[]) => void;
  clearChecked: () => void;
  checkAll: (emailIds: string[]) => void;
  updateFilters: (partial: Partial<EmailFiltersState>) => void;
  resetFilters: () => void;
}

export type EmailStore = EmailStoreState & EmailStoreActions;

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY_KONTO = "email-selected-konto";
const STORAGE_KEY_ORDNER = "email-selected-ordner";

const DEFAULT_FILTERS: EmailFiltersState = {
  gelesen: null,
  veraktet: "alle",
  akteId: undefined,
  verantwortlichId: undefined,
  search: "",
  sort: "empfangenAm",
  sortOrder: "desc",
};

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useEmailStore(): EmailStore {
  const [selectedKontoId, setSelectedKontoId] = useState<string | null>(null);
  const [selectedOrdnerId, setSelectedOrdnerId] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [filters, setFilters] = useState<EmailFiltersState>(DEFAULT_FILTERS);
  const [checkedEmailIds, setCheckedEmailIds] = useState<Set<string>>(new Set());

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const storedKonto = localStorage.getItem(STORAGE_KEY_KONTO);
      const storedOrdner = localStorage.getItem(STORAGE_KEY_ORDNER);
      if (storedKonto) setSelectedKontoId(storedKonto);
      if (storedOrdner) setSelectedOrdnerId(storedOrdner);
    } catch {
      // localStorage not available (SSR or privacy mode)
    }
  }, []);

  const selectFolder = useCallback((kontoId: string | null, ordnerId: string | null) => {
    setSelectedKontoId(kontoId);
    setSelectedOrdnerId(ordnerId);
    setSelectedEmailId(null);
    setCheckedEmailIds(new Set());
    try {
      if (kontoId) localStorage.setItem(STORAGE_KEY_KONTO, kontoId);
      else localStorage.removeItem(STORAGE_KEY_KONTO);
      if (ordnerId) localStorage.setItem(STORAGE_KEY_ORDNER, ordnerId);
      else localStorage.removeItem(STORAGE_KEY_ORDNER);
    } catch {
      // localStorage not available
    }
  }, []);

  const selectEmail = useCallback((emailId: string | null) => {
    setSelectedEmailId(emailId);
  }, []);

  const toggleCheck = useCallback((emailId: string) => {
    setCheckedEmailIds((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  }, []);

  const toggleCheckRange = useCallback(
    (fromId: string, toId: string, emailIds: string[]) => {
      const fromIndex = emailIds.indexOf(fromId);
      const toIndex = emailIds.indexOf(toId);
      if (fromIndex === -1 || toIndex === -1) return;

      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      const rangeIds = emailIds.slice(start, end + 1);

      setCheckedEmailIds((prev) => {
        const next = new Set(prev);
        rangeIds.forEach((id) => next.add(id));
        return next;
      });
    },
    []
  );

  const clearChecked = useCallback(() => {
    setCheckedEmailIds(new Set());
  }, []);

  const checkAll = useCallback((emailIds: string[]) => {
    setCheckedEmailIds(new Set(emailIds));
  }, []);

  const updateFilters = useCallback((partial: Partial<EmailFiltersState>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
    // Reset email selection and checks when filters change
    setSelectedEmailId(null);
    setCheckedEmailIds(new Set());
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSelectedEmailId(null);
    setCheckedEmailIds(new Set());
  }, []);

  return {
    selectedKontoId,
    selectedOrdnerId,
    selectedEmailId,
    filters,
    checkedEmailIds,
    selectFolder,
    selectEmail,
    toggleCheck,
    toggleCheckRange,
    clearChecked,
    checkAll,
    updateFilters,
    resetFilters,
  };
}
