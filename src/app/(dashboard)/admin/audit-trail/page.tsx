"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AuditTimeline, type AuditItem } from "@/components/audit/audit-timeline";
import { AuditExportDialog } from "@/components/audit/audit-export-dialog";
import { Download, Search, Filter } from "lucide-react";
import { AKTION_LABELS } from "@/lib/audit";

interface UserOption {
  id: string;
  name: string;
}

export default function AdminAuditTrailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter state from URL
  const [userId, setUserId] = useState(searchParams.get("userId") ?? "");
  const [akteId, setAkteId] = useState(searchParams.get("akteId") ?? "");
  const [aktion, setAktion] = useState(searchParams.get("aktion") ?? "");
  const [von, setVon] = useState(searchParams.get("von") ?? "");
  const [bis, setBis] = useState(searchParams.get("bis") ?? "");
  const [searchText, setSearchText] = useState(searchParams.get("search") ?? "");

  // Data state
  const [items, setItems] = useState<AuditItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [exportOpen, setExportOpen] = useState(false);

  // Load users for dropdown
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? data ?? []))
      .catch(() => {});
  }, []);

  // Build filter params
  const buildParams = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams();
      params.set("take", "50");
      if (cursor) params.set("cursor", cursor);
      if (userId) params.set("userId", userId);
      if (akteId) params.set("akteId", akteId);
      if (aktion) params.set("aktion", aktion);
      if (von) params.set("von", von);
      if (bis) params.set("bis", bis);
      if (searchText) params.set("search", searchText);
      return params;
    },
    [userId, akteId, aktion, von, bis, searchText]
  );

  // Fetch audit items
  const fetchItems = useCallback(
    async (cursor?: string | null) => {
      setLoading(true);
      try {
        const params = buildParams(cursor);
        const res = await fetch(`/api/admin/audit-trail?${params}`);
        if (!res.ok) return;
        const data = await res.json();

        if (cursor) {
          setItems((prev) => [...prev, ...data.items]);
        } else {
          setItems(data.items);
        }
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    },
    [buildParams]
  );

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    if (akteId) params.set("akteId", akteId);
    if (aktion) params.set("aktion", aktion);
    if (von) params.set("von", von);
    if (bis) params.set("bis", bis);
    if (searchText) params.set("search", searchText);

    const qs = params.toString();
    router.replace(`/admin/audit-trail${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [userId, akteId, aktion, von, bis, searchText, router]);

  // Fetch on filter change
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function handleLoadMore() {
    if (nextCursor) fetchItems(nextCursor);
  }

  // Get unique action types for dropdown
  const actionOptions = Object.entries(AKTION_LABELS).sort((a, b) =>
    a[1].localeCompare(b[1], "de")
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit-Trail</h1>
          <p className="text-muted-foreground text-sm mt-1">
            System-weite Aktivitaeten und Aenderungshistorie
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
          <Download className="w-4 h-4 mr-2" />
          Exportieren
        </Button>
      </div>

      {/* Filter bar */}
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Filter</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* User filter */}
          <div className="space-y-1">
            <Label className="text-xs">Benutzer</Label>
            <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Alle</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Akte search */}
          <div className="space-y-1">
            <Label className="text-xs">Akte (ID)</Label>
            <Input
              placeholder="Akten-ID..."
              value={akteId}
              onChange={(e) => setAkteId(e.target.value)}
              className="h-10"
            />
          </div>

          {/* Action type */}
          <div className="space-y-1">
            <Label className="text-xs">Aktion</Label>
            <Select value={aktion} onChange={(e) => setAktion(e.target.value)}>
              <option value="">Alle Aktionen</option>
              {actionOptions.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          {/* Date range */}
          <div className="space-y-1">
            <Label className="text-xs">Von</Label>
            <Input
              type="date"
              value={von}
              onChange={(e) => setVon(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bis</Label>
            <Input
              type="date"
              value={bis}
              onChange={(e) => setBis(e.target.value)}
              className="h-10"
            />
          </div>

          {/* Text search */}
          <div className="space-y-1">
            <Label className="text-xs">Suche</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Suche..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="h-10 pl-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-4">
        <AuditTimeline
          items={items}
          hasMore={hasMore}
          loading={loading}
          onLoadMore={handleLoadMore}
          showAkteLink
        />
      </div>

      {/* Export dialog */}
      <AuditExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filterParams={buildParams()}
      />
    </div>
  );
}
