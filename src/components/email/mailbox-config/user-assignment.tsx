"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface EmailKonto {
  id: string;
  name: string;
  emailAdresse: string;
}

interface Assignment {
  kontoId: string;
  userId: string;
}

export function UserAssignment() {
  const [users, setUsers] = useState<User[]>([]);
  const [konten, setKonten] = useState<EmailKonto[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingCells, setUpdatingCells] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      const [usersRes, kontenRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/email-konten"),
      ]);

      const usersData = usersRes.ok ? await usersRes.json() : [];
      const kontenData = kontenRes.ok ? await kontenRes.json() : [];

      setUsers(Array.isArray(usersData) ? usersData : usersData?.data ?? []);
      setKonten(Array.isArray(kontenData) ? kontenData : []);

      // Load assignments for each konto
      const allAssignments: Assignment[] = [];
      for (const konto of (Array.isArray(kontenData) ? kontenData : [])) {
        try {
          const res = await fetch(`/api/email-konten/${konto.id}/zuweisungen`);
          if (res.ok) {
            const zuweisungen = await res.json();
            for (const z of Array.isArray(zuweisungen) ? zuweisungen : []) {
              allAssignments.push({
                kontoId: konto.id,
                userId: z.userId || z.user?.id,
              });
            }
          }
        } catch {
          // Continue loading other assignments
        }
      }
      setAssignments(allAssignments);
    } catch {
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const cellKey = (kontoId: string, userId: string) =>
    `${kontoId}:${userId}`;

  const isAssigned = (kontoId: string, userId: string) =>
    assignments.some(
      (a) => a.kontoId === kontoId && a.userId === userId
    );

  const toggleAssignment = async (kontoId: string, userId: string) => {
    const key = cellKey(kontoId, userId);
    setUpdatingCells((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });

    const assigned = isAssigned(kontoId, userId);

    try {
      if (assigned) {
        // Remove assignment
        const res = await fetch(
          `/api/email-konten/${kontoId}/zuweisungen?userId=${userId}`,
          { method: "DELETE" }
        );
        if (res.ok || res.status === 204) {
          setAssignments((prev) =>
            prev.filter(
              (a) => !(a.kontoId === kontoId && a.userId === userId)
            )
          );
        } else {
          toast.error("Fehler beim Entfernen der Zuweisung");
        }
      } else {
        // Add assignment
        const res = await fetch(
          `/api/email-konten/${kontoId}/zuweisungen`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          }
        );
        if (res.ok) {
          setAssignments((prev) => [...prev, { kontoId, userId }]);
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error || "Fehler beim Zuweisen");
        }
      }
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setUpdatingCells((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Lade Zuweisungen...
      </div>
    );
  }

  if (konten.length === 0 || users.length === 0) {
    return (
      <div className="text-center py-12 glass rounded-xl">
        <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-foreground font-medium">
          {konten.length === 0
            ? "Keine Postfaecher vorhanden"
            : "Keine Benutzer vorhanden"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Erstellen Sie zuerst Postfaecher und Benutzer, um Zuweisungen vornehmen zu koennen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Weisen Sie Benutzer ihren E-Mail-Postfaechern zu. Benutzer koennen nur auf
        zugewiesene Postfaecher zugreifen.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 dark:border-white/[0.06]">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">
                Benutzer
              </th>
              {konten.map((konto) => (
                <th
                  key={konto.id}
                  className="text-center py-3 px-3 text-xs font-medium text-muted-foreground"
                >
                  <div className="truncate max-w-[120px]">{konto.name}</div>
                  <div className="text-[10px] font-normal text-muted-foreground/60">
                    {konto.emailAdresse}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-white/5 dark:border-white/[0.03] hover:bg-white/10 dark:hover:bg-white/[0.02]"
              >
                <td className="py-2 px-3">
                  <div className="font-medium text-foreground">
                    {user.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {user.email}
                  </div>
                </td>
                {konten.map((konto) => {
                  const key = cellKey(konto.id, user.id);
                  const assigned = isAssigned(konto.id, user.id);
                  const updating = updatingCells.has(key);

                  return (
                    <td key={konto.id} className="text-center py-2 px-3">
                      <button
                        type="button"
                        onClick={() =>
                          toggleAssignment(konto.id, user.id)
                        }
                        disabled={updating}
                        className={`w-6 h-6 rounded border transition-colors inline-flex items-center justify-center ${
                          assigned
                            ? "bg-brand-600 border-brand-600 text-white"
                            : "border-white/30 dark:border-white/[0.15] hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10"
                        } ${updating ? "opacity-50" : ""}`}
                      >
                        {updating ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : assigned ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
