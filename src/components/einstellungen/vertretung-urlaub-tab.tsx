"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  UserCheck,
  Calendar,
  Trash2,
  Plus,
  RotateCcw,
  Shield,
} from "lucide-react";

interface UserVertretung {
  id: string;
  name: string;
  email: string;
  role: string;
  vertreterId: string | null;
  vertreterName: string | null;
  vertretungAktiv: boolean;
  vertretungVon: string | null;
  vertretungBis: string | null;
}

interface UrlaubZeitraum {
  id: string;
  userId: string;
  von: string;
  bis: string;
  notiz: string | null;
  createdAt: string;
}

export function VertretungUrlaubTab() {
  const [users, setUsers] = useState<UserVertretung[]>([]);
  const [allUsers, setAllUsers] = useState<
    { id: string; name: string; email: string; role: string }[]
  >([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [urlaubZeitraeume, setUrlaubZeitraeume] = useState<UrlaubZeitraum[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [showVertretungDialog, setShowVertretungDialog] = useState(false);
  const [showUrlaubDialog, setShowUrlaubDialog] = useState(false);
  const [dialogUserId, setDialogUserId] = useState<string | null>(null);
  const [vertreterId, setVertreterId] = useState("");
  const [vertretungVon, setVertretungVon] = useState("");
  const [vertretungBis, setVertretungBis] = useState("");
  const [urlaubVon, setUrlaubVon] = useState("");
  const [urlaubBis, setUrlaubBis] = useState("");
  const [urlaubNotiz, setUrlaubNotiz] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Fehler beim Laden der Benutzer");
      const data = await res.json();
      setAllUsers(data);

      // Load Vertretung info for each user
      const usersWithVertretung: UserVertretung[] = await Promise.all(
        data.map(async (u: any) => {
          try {
            const vRes = await fetch(`/api/users/${u.id}/vertretung`);
            if (!vRes.ok) return { ...u, vertreterId: null, vertreterName: null, vertretungAktiv: false, vertretungVon: null, vertretungBis: null };
            const vData = await vRes.json();
            return {
              ...u,
              vertreterId: vData.vertreterId,
              vertreterName: vData.vertreterName,
              vertretungAktiv: vData.vertretungAktiv,
              vertretungVon: vData.vertretungVon,
              vertretungBis: vData.vertretungBis,
            };
          } catch {
            return { ...u, vertreterId: null, vertreterName: null, vertretungAktiv: false, vertretungVon: null, vertretungBis: null };
          }
        })
      );
      setUsers(usersWithVertretung);
    } catch (err) {
      toast.error("Fehler beim Laden der Benutzer");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUrlaub = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}/urlaub`);
      if (!res.ok) throw new Error("Fehler");
      const data = await res.json();
      setUrlaubZeitraeume(data);
    } catch {
      toast.error("Fehler beim Laden der Urlaubszeitraeume");
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (selectedUserId) {
      loadUrlaub(selectedUserId);
    }
  }, [selectedUserId, loadUrlaub]);

  const openVertretungDialog = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    setDialogUserId(userId);
    setVertreterId(user?.vertreterId ?? "");
    setVertretungVon(user?.vertretungVon ? user.vertretungVon.split("T")[0] : "");
    setVertretungBis(user?.vertretungBis ? user.vertretungBis.split("T")[0] : "");
    setShowVertretungDialog(true);
  };

  const saveVertretung = async (aktivieren?: boolean) => {
    if (!dialogUserId) return;
    try {
      const body: any = {};
      if (vertreterId) body.vertreterId = vertreterId;
      if (vertretungVon) body.vertretungVon = vertretungVon;
      if (vertretungBis) body.vertretungBis = vertretungBis;
      if (aktivieren !== undefined) body.aktivieren = aktivieren;

      const res = await fetch(`/api/users/${dialogUserId}/vertretung`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler");
      }

      toast.success(
        aktivieren
          ? "Vertretungs-Modus aktiviert"
          : aktivieren === false
            ? "Vertretungs-Modus deaktiviert"
            : "Vertreter gespeichert"
      );
      setShowVertretungDialog(false);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Fehler beim Speichern");
    }
  };

  const deactivateVertretung = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}/vertretung`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktivieren: false }),
      });
      if (!res.ok) throw new Error("Fehler");
      toast.success("Vertretungs-Modus deaktiviert");
      loadUsers();
    } catch {
      toast.error("Fehler beim Deaktivieren");
    }
  };

  const resetAllVertretungen = async () => {
    if (!confirm("Alle Vertretungszuweisungen zuruecksetzen?")) return;
    try {
      for (const user of users) {
        if (user.vertreterId || user.vertretungAktiv) {
          await fetch(`/api/users/${user.id}/vertretung`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              vertreterId: null,
              aktivieren: false,
              vertretungVon: null,
              vertretungBis: null,
            }),
          });
        }
      }
      toast.success("Alle Vertretungen zurueckgesetzt");
      loadUsers();
    } catch {
      toast.error("Fehler beim Zuruecksetzen");
    }
  };

  const addUrlaub = async () => {
    if (!selectedUserId || !urlaubVon || !urlaubBis) return;
    try {
      const res = await fetch(`/api/users/${selectedUserId}/urlaub`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ von: urlaubVon, bis: urlaubBis, notiz: urlaubNotiz || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler");
      }
      toast.success("Urlaubszeitraum hinzugefuegt");
      setShowUrlaubDialog(false);
      setUrlaubVon("");
      setUrlaubBis("");
      setUrlaubNotiz("");
      loadUrlaub(selectedUserId);
    } catch (err: any) {
      toast.error(err.message || "Fehler beim Speichern");
    }
  };

  const deleteUrlaub = async (zeitraumId: string) => {
    if (!selectedUserId) return;
    try {
      const res = await fetch(
        `/api/users/${selectedUserId}/urlaub?zeitraumId=${zeitraumId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Fehler");
      toast.success("Urlaubszeitraum geloescht");
      loadUrlaub(selectedUserId);
    } catch {
      toast.error("Fehler beim Loeschen");
    }
  };

  const isOnVacation = (user: UserVertretung): boolean => {
    if (!user.vertretungAktiv) return false;
    const now = new Date();
    if (user.vertretungVon && new Date(user.vertretungVon) > now) return false;
    if (user.vertretungBis && new Date(user.vertretungBis) < now) return false;
    return true;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Lade Benutzerdaten...</div>
      </div>
    );
  }

  const activeVertretungen = users.filter((u) => u.vertretungAktiv);

  return (
    <div className="space-y-6">
      {/* Active Vertretungen section */}
      {activeVertretungen.length > 0 && (
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-heading text-foreground">
              Aktive Vertretungen
            </h3>
          </div>
          <div className="space-y-2">
            {activeVertretungen.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="warning">Abwesend</Badge>
                  <span className="text-sm font-medium">{u.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Vertreter: {u.vertreterName}
                  </span>
                  {u.vertretungVon && u.vertretungBis && (
                    <span className="text-xs text-muted-foreground">
                      ({new Date(u.vertretungVon).toLocaleDateString("de-DE")} -{" "}
                      {new Date(u.vertretungBis).toLocaleDateString("de-DE")})
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deactivateVertretung(u.id)}
                >
                  Deaktivieren
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User list with Vertretung assignments */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-heading text-foreground">
              Vertretungszuweisungen
            </h3>
          </div>
          <Button variant="ghost" size="sm" onClick={resetAllVertretungen}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Auf Standard zuruecksetzen
          </Button>
        </div>

        <div className="divide-y divide-white/10 dark:divide-white/[0.06]">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between py-3"
            >
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{user.name}</span>
                    {isOnVacation(user) && (
                      <Badge variant="warning">Abwesend</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {user.email} - {user.role}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {user.vertreterName ? (
                  <span className="text-xs text-muted-foreground">
                    <UserCheck className="w-3 h-3 inline mr-1" />
                    {user.vertreterName}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/60">
                    Kein Vertreter
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openVertretungDialog(user.id)}
                >
                  Bearbeiten
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Urlaub section */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-heading text-foreground">
            Urlaubsverwaltung
          </h3>
        </div>

        {/* User selector */}
        <div className="mb-4">
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedUserId ?? ""}
            onChange={(e) => setSelectedUserId(e.target.value || null)}
          >
            <option value="">Benutzer auswaehlen...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </div>

        {selectedUserId && (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">
                Urlaubszeitraeume fuer{" "}
                {users.find((u) => u.id === selectedUserId)?.name}
              </span>
              <Button
                size="sm"
                onClick={() => setShowUrlaubDialog(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Urlaub hinzufuegen
              </Button>
            </div>

            {urlaubZeitraeume.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Keine Urlaubszeitraeume eingetragen.
              </p>
            ) : (
              <div className="space-y-2">
                {urlaubZeitraeume.map((z) => (
                  <div
                    key={z.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30"
                  >
                    <div>
                      <span className="text-sm font-medium">
                        {new Date(z.von).toLocaleDateString("de-DE")} -{" "}
                        {new Date(z.bis).toLocaleDateString("de-DE")}
                      </span>
                      {z.notiz && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({z.notiz})
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteUrlaub(z.id)}
                    >
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Vertretung Dialog (simple overlay) */}
      {showVertretungDialog && dialogUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass rounded-xl p-6 w-full max-w-md space-y-4 mx-4">
            <h3 className="text-lg font-heading">
              Vertretung fuer{" "}
              {users.find((u) => u.id === dialogUserId)?.name}
            </h3>

            <div>
              <label className="text-sm font-medium block mb-1">
                Vertreter
              </label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={vertreterId}
                onChange={(e) => setVertreterId(e.target.value)}
              >
                <option value="">Vertreter auswaehlen...</option>
                {allUsers
                  .filter((u) => u.id !== dialogUserId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium block mb-1">Von</label>
                <Input
                  type="date"
                  value={vertretungVon}
                  onChange={(e) => setVertretungVon(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Bis</label>
                <Input
                  type="date"
                  value={vertretungBis}
                  onChange={(e) => setVertretungBis(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="default"
                className="flex-1"
                onClick={() => saveVertretung(true)}
                disabled={!vertreterId}
              >
                Aktivieren
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => saveVertretung()}
                disabled={!vertreterId}
              >
                Nur speichern
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowVertretungDialog(false)}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Urlaub Dialog (simple overlay) */}
      {showUrlaubDialog && selectedUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass rounded-xl p-6 w-full max-w-md space-y-4 mx-4">
            <h3 className="text-lg font-heading">
              Urlaub fuer{" "}
              {users.find((u) => u.id === selectedUserId)?.name}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium block mb-1">Von</label>
                <Input
                  type="date"
                  value={urlaubVon}
                  onChange={(e) => setUrlaubVon(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Bis</label>
                <Input
                  type="date"
                  value={urlaubBis}
                  onChange={(e) => setUrlaubBis(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">
                Notiz (optional)
              </label>
              <Input
                value={urlaubNotiz}
                onChange={(e) => setUrlaubNotiz(e.target.value)}
                placeholder="z.B. Sommerurlaub 2026"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={addUrlaub}
                disabled={!urlaubVon || !urlaubBis}
              >
                Speichern
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowUrlaubDialog(false)}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
