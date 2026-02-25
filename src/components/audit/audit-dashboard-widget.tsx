"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowRight, Loader2 } from "lucide-react";
import { AuditTimeline, type AuditItem } from "./audit-timeline";

/**
 * Compact audit widget showing the last 5 events.
 * Used on the admin system page.
 */
export function AuditDashboardWidget() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/audit-trail?take=5");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      // Silently handle fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Letzte Aktivitaeten</CardTitle>
          </div>
          <Link
            href="/admin/audit-trail"
            className="text-xs text-brand-600 hover:underline flex items-center gap-1"
          >
            Alle anzeigen <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <AuditTimeline
            items={items}
            hasMore={false}
            compact
            showAkteLink
          />
        )}
      </CardContent>
    </Card>
  );
}
