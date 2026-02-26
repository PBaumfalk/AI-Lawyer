"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  FolderOpen,
  Mail,
  User,
  Clock,
  Calendar,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TicketTagBadge } from "@/components/tickets/ticket-tag-badge";

interface TicketData {
  id: string;
  titel: string;
  beschreibung: string | null;
  status: string;
  prioritaet: string;
  faelligAm: string | null;
  verantwortlichId: string | null;
  akteId: string | null;
  tags: string[];
  erledigtAm: string | null;
  createdAt: string;
  updatedAt: string;
  akte: { id: string; aktenzeichen: string; kurzrubrum: string | null } | null;
  verantwortlich: { id: string; name: string | null } | null;
  emails: { id: string; betreff: string; absender: string }[];
}

interface UserOption {
  id: string;
  name: string | null;
}

interface AkteOption {
  id: string;
  aktenzeichen: string;
}

interface TicketDetailProps {
  ticket: TicketData;
  users: UserOption[];
  akten: AkteOption[];
}

const statusColors: Record<string, string> = {
  OFFEN: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  IN_BEARBEITUNG: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  ERLEDIGT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
};

const statusLabels: Record<string, string> = {
  OFFEN: "Offen",
  IN_BEARBEITUNG: "In Bearbeitung",
  ERLEDIGT: "Erledigt",
};

const prioritaetColors: Record<string, string> = {
  NIEDRIG: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-muted-foreground",
  NORMAL: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  HOCH: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  KRITISCH: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
};

const prioritaetLabels: Record<string, string> = {
  NIEDRIG: "Niedrig",
  NORMAL: "Normal",
  HOCH: "Hoch",
  KRITISCH: "Kritisch",
};

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().split("T")[0];
}

export function TicketDetail({ ticket, users, akten }: TicketDetailProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Inline edit states
  const [editingBeschreibung, setEditingBeschreibung] = useState(false);
  const [beschreibung, setBeschreibung] = useState(ticket.beschreibung ?? "");

  const [editingFaelligkeit, setEditingFaelligkeit] = useState(false);
  const [faelligAm, setFaelligAm] = useState(formatDateInput(ticket.faelligAm));

  const [editingTitel, setEditingTitel] = useState(false);
  const [titel, setTitel] = useState(ticket.titel);

  async function patchTicket(data: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveBeschreibung() {
    await patchTicket({ beschreibung: beschreibung || null });
    setEditingBeschreibung(false);
  }

  async function saveFaelligkeit() {
    await patchTicket({ faelligAm: faelligAm || null });
    setEditingFaelligkeit(false);
  }

  async function saveTitel() {
    if (!titel.trim()) return;
    await patchTicket({ titel: titel.trim() });
    setEditingTitel(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/tickets"
          className="p-2 rounded-lg hover:bg-white/20 dark:hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-muted-foreground" />
        </Link>
        <div className="flex-1 min-w-0">
          {editingTitel ? (
            <div className="flex items-center gap-2">
              <Input
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                className="text-xl font-heading"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitel();
                  if (e.key === "Escape") {
                    setTitel(ticket.titel);
                    setEditingTitel(false);
                  }
                }}
              />
              <button
                onClick={saveTitel}
                disabled={saving}
                className="p-1.5 rounded hover:bg-white/20 dark:hover:bg-white/[0.06] text-emerald-500"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setTitel(ticket.titel);
                  setEditingTitel(false);
                }}
                className="p-1.5 rounded hover:bg-white/20 dark:hover:bg-white/[0.06] text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h1 className="text-2xl font-heading text-foreground truncate">
                {ticket.titel}
              </h1>
              <button
                onClick={() => setEditingTitel(true)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/20 dark:hover:bg-white/[0.06] transition-opacity text-muted-foreground"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <p className="text-muted-foreground text-sm mt-1">
            Erstellt am {formatDateLong(ticket.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Beschreibung */}
          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Beschreibung
              </h2>
              {!editingBeschreibung && (
                <button
                  onClick={() => setEditingBeschreibung(true)}
                  className="p-1.5 rounded hover:bg-white/20 dark:hover:bg-white/[0.06] text-muted-foreground"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {editingBeschreibung ? (
              <div className="space-y-3">
                <textarea
                  value={beschreibung}
                  onChange={(e) => setBeschreibung(e.target.value)}
                  className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                  autoFocus
                  placeholder="Beschreibung eingeben..."
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveBeschreibung} disabled={saving}>
                    Speichern
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setBeschreibung(ticket.beschreibung ?? "");
                      setEditingBeschreibung(false);
                    }}
                  >
                    Abbrechen
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {ticket.beschreibung || (
                  <span className="text-muted-foreground italic">
                    Keine Beschreibung vorhanden.
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Verknüpfte E-Mails */}
          {ticket.emails.length > 0 && (
            <div className="glass rounded-xl p-6">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Verknüpfte E-Mails
              </h2>
              <div className="space-y-2">
                {ticket.emails.map((email) => (
                  <Link
                    key={email.id}
                    href={`/email/${email.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/20 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {email.betreff}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {email.absender}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {ticket.tags.length > 0 && (
            <div className="glass rounded-xl p-6">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Tags
              </h2>
              <div className="flex gap-2 flex-wrap">
                {ticket.tags.map((t) => (
                  <TicketTagBadge key={t} tag={t} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar metadata */}
        <div className="space-y-6">
          {/* Status */}
          <div className="glass rounded-xl p-6 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                Status
              </label>
              <Select
                value={ticket.status}
                onChange={(e) => patchTicket({ status: e.target.value })}
                disabled={saving}
                className="w-full"
              >
                <option value="OFFEN">Offen</option>
                <option value="IN_BEARBEITUNG">In Bearbeitung</option>
                <option value="ERLEDIGT">Erledigt</option>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                Priorität
              </label>
              <Select
                value={ticket.prioritaet}
                onChange={(e) => patchTicket({ prioritaet: e.target.value })}
                disabled={saving}
                className="w-full"
              >
                <option value="NIEDRIG">Niedrig</option>
                <option value="NORMAL">Normal</option>
                <option value="HOCH">Hoch</option>
                <option value="KRITISCH">Kritisch</option>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                Verantwortlich
              </label>
              <Select
                value={ticket.verantwortlichId ?? ""}
                onChange={(e) =>
                  patchTicket({ verantwortlichId: e.target.value || null })
                }
                disabled={saving}
                className="w-full"
              >
                <option value="">– Niemand –</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.id}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Fälligkeit
                </label>
                {!editingFaelligkeit && (
                  <button
                    onClick={() => setEditingFaelligkeit(true)}
                    className="p-1 rounded hover:bg-white/20 dark:hover:bg-white/[0.06] text-muted-foreground"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
              {editingFaelligkeit ? (
                <div className="space-y-2">
                  <Input
                    type="date"
                    value={faelligAm}
                    onChange={(e) => setFaelligAm(e.target.value)}
                    className="w-full"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveFaelligkeit} disabled={saving}>
                      Speichern
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setFaelligAm(formatDateInput(ticket.faelligAm));
                        setEditingFaelligkeit(false);
                      }}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground">
                  {ticket.faelligAm ? (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      {formatDateLong(ticket.faelligAm)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">Nicht gesetzt</span>
                  )}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                Akte
              </label>
              <Select
                value={ticket.akteId ?? ""}
                onChange={(e) =>
                  patchTicket({ akteId: e.target.value || null })
                }
                disabled={saving}
                className="w-full"
              >
                <option value="">– Keine Akte –</option>
                {akten.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.aktenzeichen}
                  </option>
                ))}
              </Select>
              {ticket.akte && (
                <Link
                  href={`/akten/${ticket.akte.id}`}
                  className="flex items-center gap-1.5 text-xs text-brand-600 hover:underline mt-2"
                >
                  <FolderOpen className="w-3 h-3" />
                  {ticket.akte.aktenzeichen}
                  {ticket.akte.kurzrubrum && ` – ${ticket.akte.kurzrubrum}`}
                </Link>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Zeitstempel
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>Erstellt: {formatDateLong(ticket.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>Aktualisiert: {formatDateLong(ticket.updatedAt)}</span>
              </div>
              {ticket.erledigtAm && (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Erledigt: {formatDateLong(ticket.erledigtAm)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
