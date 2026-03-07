"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import {
  Calendar,
  Plus,
  RefreshCw,
  Trash2,
  Loader2,
  Globe,
  ChevronRight,
  ChevronLeft,
  X,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CalDavKonto {
  id: string;
  provider: "GOOGLE" | "APPLE";
  name: string;
  serverUrl: string;
  benutzername: string;
  selectedCalendarUrl: string | null;
  aktiv: boolean;
  syncStatus: "VERBUNDEN" | "FEHLER" | "GETRENNT" | "SYNCHRONISIEREND";
  letzterSync: string | null;
  createdAt: string;
}

interface CalDavCalendarInfo {
  url: string;
  displayName: string;
  ctag?: string;
  color?: string;
}

type Provider = "GOOGLE" | "APPLE";
type DialogStep = "provider" | "credentials" | "calendars";

// ─── Component ───────────────────────────────────────────────────────────────

export function CalDavTab() {
  const [konten, setKonten] = useState<CalDavKonto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [dialogStep, setDialogStep] = useState<DialogStep>("provider");
  const [saving, setSaving] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form fields
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [calendars, setCalendars] = useState<CalDavCalendarInfo[]>([]);
  const [selectedCalendarUrl, setSelectedCalendarUrl] = useState<string>("");
  const [newKontoId, setNewKontoId] = useState<string>("");

  const fetchKonten = useCallback(async () => {
    try {
      const res = await fetch("/api/caldav-konten");
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setKonten(Array.isArray(data) ? data : []);
    } catch {
      toast.error("CalDAV-Konten konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKonten();
  }, [fetchKonten]);

  const resetDialog = () => {
    setShowAddDialog(false);
    setSelectedProvider(null);
    setDialogStep("provider");
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setCalendars([]);
    setSelectedCalendarUrl("");
    setNewKontoId("");
    setSaving(false);
  };

  const handleSelectProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setDialogStep("credentials");
    if (provider === "GOOGLE") {
      setFormName("Google Kalender");
    } else {
      setFormName("Apple iCloud Kalender");
    }
  };

  const handleSubmitCredentials = async () => {
    if (!selectedProvider || !formName.trim() || !formEmail.trim() || !formPassword.trim()) {
      toast.error("Bitte alle Felder ausfuellen");
      return;
    }
    setSaving(true);
    try {
      const serverUrl =
        selectedProvider === "GOOGLE"
          ? "https://apidata.googleusercontent.com/caldav/v2"
          : "https://caldav.icloud.com";

      const res = await fetch("/api/caldav-konten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          name: formName.trim(),
          serverUrl,
          benutzername: formEmail.trim(),
          passwort: formPassword.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Verbindung fehlgeschlagen");
      }

      const data = await res.json();
      setNewKontoId(data.konto?.id ?? data.id);
      setCalendars(data.calendars ?? []);

      if (data.calendars && data.calendars.length > 0) {
        setSelectedCalendarUrl(data.calendars[0].url);
        setDialogStep("calendars");
      } else {
        // No calendars returned, close dialog
        toast.success("Kalender verbunden");
        resetDialog();
        fetchKonten();
      }
    } catch (err: any) {
      toast.error(err.message || "Verbindung fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectCalendar = async () => {
    if (!newKontoId || !selectedCalendarUrl) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/caldav-konten/${newKontoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedCalendarUrl }),
      });
      if (!res.ok) throw new Error("Fehler beim Speichern");
      toast.success("Kalender verbunden und ausgewaehlt");
      resetDialog();
      fetchKonten();
    } catch {
      toast.error("Kalenderauswahl fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (kontoId: string) => {
    setSyncingIds((prev) => new Set(prev).add(kontoId));
    try {
      const res = await fetch(`/api/caldav-konten/${kontoId}/sync`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Sync fehlgeschlagen");
      toast.success("Synchronisation gestartet");
      // Refresh after a short delay to show updated status
      setTimeout(() => fetchKonten(), 2000);
    } catch {
      toast.error("Synchronisation konnte nicht gestartet werden");
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(kontoId);
        return next;
      });
    }
  };

  const handleDelete = async (kontoId: string) => {
    try {
      const res = await fetch(`/api/caldav-konten/${kontoId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Fehler beim Loeschen");
      toast.success("Kalenderverbindung entfernt");
      setDeleteConfirmId(null);
      fetchKonten();
    } catch {
      toast.error("Loeschen fehlgeschlagen");
    }
  };

  const statusBadge = (status: CalDavKonto["syncStatus"]) => {
    const map: Record<
      CalDavKonto["syncStatus"],
      { label: string; cls: string }
    > = {
      VERBUNDEN: {
        label: "Verbunden",
        cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      },
      FEHLER: {
        label: "Fehler",
        cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
      },
      GETRENNT: {
        label: "Getrennt",
        cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
      },
      SYNCHRONISIEREND: {
        label: "Synchronisiert...",
        cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      },
    };
    const { label, cls } = map[status] ?? map.GETRENNT;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`}
      >
        {status === "SYNCHRONISIEREND" && (
          <Loader2 className="w-3 h-3 animate-spin" />
        )}
        {label}
      </span>
    );
  };

  const providerIcon = (provider: Provider) => {
    if (provider === "GOOGLE") {
      return (
        <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400">
          G
        </span>
      );
    }
    return (
      <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-slate-300">

      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Lade Kalenderverbindungen...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Kalenderverbindungen
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Google Calendar und Apple iCloud Kalender verbinden
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Kalender verbinden
        </Button>
      </div>

      {/* Connected accounts */}
      {konten.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <Globe className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Noch keine Kalender verbunden.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Verbinden Sie Google Calendar oder Apple iCloud Kalender, um Termine
            zu synchronisieren.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {konten.map((konto) => (
            <GlassCard key={konto.id} className="p-4">
              <div className="flex items-center gap-3">
                {providerIcon(konto.provider)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {konto.name}
                    </span>
                    {statusBadge(konto.syncStatus)}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {konto.benutzername}
                    </span>
                    {konto.letzterSync && (
                      <span className="text-[10px] text-muted-foreground">
                        Letzter Sync:{" "}
                        {new Date(konto.letzterSync).toLocaleString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => handleSync(konto.id)}
                    disabled={syncingIds.has(konto.id)}
                  >
                    {syncingIds.has(konto.id) ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    )}
                    Jetzt synchronisieren
                  </Button>
                  {deleteConfirmId === konto.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handleDelete(konto.id)}
                      >
                        Entfernen
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setDeleteConfirmId(null)}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                      onClick={() => setDeleteConfirmId(konto.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Add connection dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={resetDialog}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-slate-950 rounded-xl shadow-2xl border border-white/20 dark:border-white/[0.08] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-heading text-foreground">
                {dialogStep === "provider" && "Kalender verbinden"}
                {dialogStep === "credentials" && `${selectedProvider === "GOOGLE" ? "Google" : "Apple"} Kalender verbinden`}
                {dialogStep === "calendars" && "Kalender auswaehlen"}
              </h3>
              <button
                onClick={resetDialog}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Step 1: Provider selection */}
            {dialogStep === "provider" && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleSelectProvider("GOOGLE")}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
                >
                  <span className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-xl font-bold text-blue-600 dark:text-blue-400">
                    G
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    Google Calendar
                  </span>
                </button>
                <button
                  onClick={() => handleSelectProvider("APPLE")}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl font-bold text-slate-700 dark:text-slate-300">

                  </span>
                  <span className="text-sm font-medium text-foreground">
                    Apple iCloud
                  </span>
                </button>
              </div>
            )}

            {/* Step 2: Credentials */}
            {dialogStep === "credentials" && selectedProvider && (
              <div className="space-y-4">
                {selectedProvider === "GOOGLE" && (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/10 p-3 text-xs text-blue-700 dark:text-blue-300">
                    Erstellen Sie ein App-Passwort oder verwenden Sie OAuth2
                    Token. Geben Sie Ihren Google-Account und das App-Passwort
                    ein.
                  </div>
                )}
                {selectedProvider === "APPLE" && (
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 text-xs text-slate-600 dark:text-slate-300">
                    Erstellen Sie ein App-spezifisches Passwort unter{" "}
                    <span className="font-medium">
                      appleid.apple.com &gt; Sicherheit
                    </span>
                  </div>
                )}

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Mein Kalender"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    {selectedProvider === "APPLE" ? "Apple-ID (E-Mail)" : "Google-Account (E-Mail)"}
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    {selectedProvider === "APPLE"
                      ? "App-spezifisches Passwort"
                      : "App-Passwort"}
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                  />
                </div>

                <div className="flex justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDialogStep("provider");
                      setSelectedProvider(null);
                    }}
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Zurueck
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmitCredentials}
                    disabled={
                      saving ||
                      !formName.trim() ||
                      !formEmail.trim() ||
                      !formPassword.trim()
                    }
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 mr-1" />
                    )}
                    Verbinden
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Calendar selection */}
            {dialogStep === "calendars" && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Waehlen Sie den Kalender aus, der synchronisiert werden soll:
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {calendars.map((cal) => (
                    <label
                      key={cal.url}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        selectedCalendarUrl === cal.url
                          ? "border-primary bg-primary/5 dark:bg-primary/10"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="calendar"
                        value={cal.url}
                        checked={selectedCalendarUrl === cal.url}
                        onChange={() => setSelectedCalendarUrl(cal.url)}
                        className="accent-primary"
                      />
                      <div className="flex items-center gap-2">
                        {cal.color && (
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: cal.color }}
                          />
                        )}
                        <span className="text-sm text-foreground">
                          {cal.displayName || cal.url}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={handleSelectCalendar}
                    disabled={saving || !selectedCalendarUrl}
                  >
                    {saving && (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    )}
                    Kalender auswaehlen
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
