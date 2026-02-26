"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X, ShieldCheck, ChevronDown, Wallet } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { GlassCard } from "@/components/ui/glass-card";

interface PermissionMatrix {
  role: string;
  label: string;
  permissions: Record<string, boolean>;
}

interface UserOverview {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  permissions: Record<string, boolean>;
  canSeeKanzleiFinanzen: boolean;
  accessibleAkten: {
    id: string;
    aktenzeichen: string;
    kurzrubrum: string;
    sources: string[];
  }[];
}

interface RollenData {
  matrix: PermissionMatrix[];
  permissionLabels: Record<string, string>;
  roleLabels: Record<string, string>;
  users: UserOverview[];
}

export default function RollenPage() {
  const [data, setData] = useState<RollenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/rollen");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // Error handling
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Lade Rollen-Matrix...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Fehler beim Laden der Rollen-Daten
      </div>
    );
  }

  const permKeys = data.matrix.length > 0
    ? Object.keys(data.matrix[0].permissions)
    : [];

  const selectedUser = data.users.find((u) => u.id === selectedUserId);

  // Toggle canSeeKanzleiFinanzen via PATCH
  const handleToggleFinanzen = useCallback(async (userId: string, newValue: boolean) => {
    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        users: prev.users.map((u) =>
          u.id === userId ? { ...u, canSeeKanzleiFinanzen: newValue } : u
        ),
      };
    });

    try {
      const res = await fetch("/api/admin/rollen", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, canSeeKanzleiFinanzen: newValue }),
      });
      if (!res.ok) {
        // Revert on error
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            users: prev.users.map((u) =>
              u.id === userId ? { ...u, canSeeKanzleiFinanzen: !newValue } : u
            ),
          };
        });
      }
    } catch {
      // Revert on error
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          users: prev.users.map((u) =>
            u.id === userId ? { ...u, canSeeKanzleiFinanzen: !newValue } : u
          ),
        };
      });
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-brand-600" />
          Rollen und Berechtigungen
        </h1>
        <p className="text-muted-foreground mt-1">
          Uebersicht der Berechtigungsmatrix und benutzerspezifische Zugriffe.
          Berechtigungen sind im Code definiert und nicht konfigurierbar.
        </p>
      </div>

      {/* Permission Matrix Table */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Berechtigungsmatrix</h2>
        <GlassPanel elevation="panel" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 font-medium border-b">Rolle</th>
                {permKeys.map((key) => (
                  <th
                    key={key}
                    className="text-center px-3 py-3 font-medium border-b whitespace-nowrap"
                  >
                    {data.permissionLabels[key] || key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.matrix.map((row, idx) => (
                <tr
                  key={row.role}
                  className={idx % 2 === 0 ? "" : "bg-muted/20"}
                >
                  <td className="px-4 py-3 font-medium border-b">
                    {row.label}
                  </td>
                  {permKeys.map((key) => (
                    <td
                      key={key}
                      className="text-center px-3 py-3 border-b"
                    >
                      {row.permissions[key] ? (
                        <Check className="w-5 h-5 text-emerald-600 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-rose-400 mx-auto" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </GlassPanel>
      </div>

      {/* Per-User Overview */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Benutzerspezifische Uebersicht</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Waehlen Sie einen Benutzer aus, um dessen zugaengliche Akten und Zugriffsquellen einzusehen.
        </p>

        <div className="relative w-full max-w-md mb-4">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full appearance-none px-4 py-2.5 pr-10 border rounded-lg bg-background text-sm"
          >
            <option value="">Benutzer waehlen...</option>
            {data.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.roleLabel})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>

        {selectedUser && (
          <div className="space-y-4">
            {/* User info card */}
            <GlassCard className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{selectedUser.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedUser.email} -- {selectedUser.roleLabel}
                  </div>
                </div>
                {/* canSeeKanzleiFinanzen toggle -- only visible for ANWALT users */}
                {selectedUser.role === "ANWALT" && (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <Wallet className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Kanzleiweite Finanzen</span>
                    <input
                      type="checkbox"
                      checked={selectedUser.canSeeKanzleiFinanzen}
                      onChange={(e) => handleToggleFinanzen(selectedUser.id, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                  </label>
                )}
              </div>
            </GlassCard>

            {/* Accessible Akten */}
            {selectedUser.accessibleAkten.length > 0 ? (
              <GlassPanel elevation="panel" className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-4 py-2.5 font-medium border-b">Aktenzeichen</th>
                      <th className="text-left px-4 py-2.5 font-medium border-b">Kurzrubrum</th>
                      <th className="text-left px-4 py-2.5 font-medium border-b">Zugriffsquelle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUser.accessibleAkten.map((akte) => (
                      <tr key={akte.id} className="border-b last:border-b-0">
                        <td className="px-4 py-2.5 font-mono text-xs">
                          {akte.aktenzeichen}
                        </td>
                        <td className="px-4 py-2.5">
                          {akte.kurzrubrum}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {akte.sources.map((source, idx) => (
                              <span
                                key={idx}
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                                  source.startsWith("direkt")
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                    : source.startsWith("Dezernat")
                                    ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                    : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                }`}
                              >
                                {source}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </GlassPanel>
            ) : (
              <GlassPanel elevation="panel" className="p-8 text-center text-muted-foreground">
                {selectedUser.role === "ADMIN"
                  ? "Administratoren haben Zugriff auf alle Akten."
                  : "Dieser Benutzer hat keinen Zugriff auf spezifische Akten."}
              </GlassPanel>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
