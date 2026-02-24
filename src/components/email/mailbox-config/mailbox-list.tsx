"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Mail,
  Edit2,
  Trash2,
  Building2,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { MailboxForm } from "./mailbox-form";

interface EmailKonto {
  id: string;
  name: string;
  emailAdresse: string;
  istKanzlei: boolean;
  aktiv: boolean;
  syncStatus: string;
  letzterSync: string | null;
  _count?: { nachrichten: number; zuweisungen: number };
}

function StatusIndicator({ status }: { status: string }) {
  switch (status) {
    case "VERBUNDEN":
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          Verbunden
        </span>
      );
    case "FEHLER":
      return (
        <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <XCircle className="w-3 h-3" />
          Fehler
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <MinusCircle className="w-3 h-3" />
          Getrennt
        </span>
      );
  }
}

export function MailboxList() {
  const [konten, setKonten] = useState<EmailKonto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editKontoId, setEditKontoId] = useState<string | undefined>();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadKonten = useCallback(async () => {
    try {
      const res = await fetch("/api/email-konten");
      if (res.ok) {
        const data = await res.json();
        setKonten(Array.isArray(data) ? data : []);
      }
    } catch {
      toast.error("Fehler beim Laden der Postfaecher");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKonten();
  }, [loadKonten]);

  const handleToggleAktiv = async (konto: EmailKonto) => {
    try {
      const res = await fetch(`/api/email-konten/${konto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktiv: !konto.aktiv }),
      });

      if (res.ok) {
        setKonten((prev) =>
          prev.map((k) =>
            k.id === konto.id ? { ...k, aktiv: !k.aktiv } : k
          )
        );
        toast.success(
          konto.aktiv ? "Postfach deaktiviert" : "Postfach aktiviert"
        );
      }
    } catch {
      toast.error("Fehler beim Aendern des Status");
    }
  };

  const handleDelete = async (kontoId: string) => {
    try {
      const res = await fetch(`/api/email-konten/${kontoId}`, {
        method: "DELETE",
      });

      if (res.ok || res.status === 204) {
        const data = res.status === 204 ? null : await res.json();
        if (data?.deaktiviert) {
          toast.info("Postfach wurde deaktiviert (noch verknuepfte E-Mails vorhanden)");
          loadKonten();
        } else {
          setKonten((prev) => prev.filter((k) => k.id !== kontoId));
          toast.success("Postfach geloescht");
        }
      } else {
        toast.error("Fehler beim Loeschen");
      }
    } catch {
      toast.error("Netzwerkfehler beim Loeschen");
    }
    setDeleteConfirmId(null);
  };

  const handleEdit = (kontoId: string) => {
    setEditKontoId(kontoId);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditKontoId(undefined);
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Lade Postfaecher...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {konten.length} Postfach{konten.length !== 1 ? "faecher" : ""} konfiguriert
        </p>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Neues Postfach hinzufuegen
        </button>
      </div>

      {/* Mailbox list */}
      {konten.length === 0 ? (
        <div className="text-center py-12 glass rounded-xl">
          <Mail className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-foreground font-medium">
            Noch kein Postfach konfiguriert
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Fuegen Sie Ihr erstes E-Mail-Postfach hinzu, um E-Mails zu empfangen und zu senden.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {konten.map((konto) => (
            <div
              key={konto.id}
              className={`glass rounded-xl p-4 flex items-center gap-4 transition-opacity ${
                !konto.aktiv ? "opacity-50" : ""
              }`}
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">
                    {konto.name}
                  </span>
                  {konto.istKanzlei && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-medium rounded">
                      <Building2 className="w-3 h-3" />
                      Kanzlei
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {konto.emailAdresse}
                </div>
              </div>

              {/* Status */}
              <div className="flex-shrink-0">
                <StatusIndicator status={konto.syncStatus} />
              </div>

              {/* Active toggle */}
              <button
                type="button"
                onClick={() => handleToggleAktiv(konto)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                  konto.aktiv ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    konto.aktiv ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleEdit(konto.id)}
                  className="p-1.5 rounded hover:bg-white/20 dark:hover:bg-white/[0.06] transition-colors"
                  title="Bearbeiten"
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(konto.id)}
                  className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                  title="Loeschen"
                >
                  <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-white/20 dark:border-white/[0.08] w-full max-w-sm p-6">
            <h3 className="text-lg font-heading text-foreground">
              Postfach loeschen?
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              Diese Aktion kann nicht rueckgaengig gemacht werden. Wenn noch
              E-Mails vorhanden sind, wird das Postfach stattdessen deaktiviert.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Loeschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form dialog */}
      {showForm && (
        <MailboxForm
          kontoId={editKontoId}
          onClose={() => setShowForm(false)}
          onSaved={loadKonten}
        />
      )}
    </div>
  );
}
