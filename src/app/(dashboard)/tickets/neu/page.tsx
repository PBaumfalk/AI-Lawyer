"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TicketTagInput } from "@/components/tickets/ticket-tag-input";

interface UserOption {
  id: string;
  name: string;
}

interface AkteOption {
  id: string;
  aktenzeichen: string;
}

export default function NeuesTicketPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [akten, setAkten] = useState<AkteOption[]>([]);

  const [titel, setTitel] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [prioritaet, setPrioritaet] = useState("NORMAL");
  const [faelligAm, setFaelligAm] = useState("");
  const [verantwortlichId, setVerantwortlichId] = useState("");
  const [akteId, setAkteId] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/akten?take=200").then((r) => r.json()),
    ])
      .then(([usersData, aktenData]) => {
        setUsers(Array.isArray(usersData) ? usersData : []);
        const items = aktenData?.items ?? aktenData;
        setAkten(Array.isArray(items) ? items : []);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titel.trim()) {
      toast.error("Titel ist erforderlich.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titel: titel.trim(),
          beschreibung: beschreibung.trim() || null,
          prioritaet,
          faelligAm: faelligAm || null,
          verantwortlichId: verantwortlichId || null,
          akteId: akteId || null,
          tags,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Fehler beim Erstellen.");
        return;
      }

      const ticket = await res.json();
      toast.success("Ticket erstellt.");
      router.push(`/tickets/${ticket.id}`);
    } catch {
      toast.error("Netzwerkfehler.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/tickets"
          className="p-2 rounded-lg hover:bg-white/20 dark:hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-muted-foreground" />
        </Link>
        <h1 className="text-2xl font-heading text-foreground">
          Neues Ticket
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="glass rounded-xl p-6 space-y-5">
        {/* Titel */}
        <div className="space-y-2">
          <Label htmlFor="titel">Titel *</Label>
          <Input
            id="titel"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            placeholder="Kurze Beschreibung der Aufgabe"
            required
            autoFocus
          />
        </div>

        {/* Beschreibung */}
        <div className="space-y-2">
          <Label htmlFor="beschreibung">Beschreibung</Label>
          <Textarea
            id="beschreibung"
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
            placeholder="Detaillierte Beschreibung (optional)"
            rows={4}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Priorität */}
          <div className="space-y-2">
            <Label htmlFor="prioritaet">Priorität</Label>
            <Select
              id="prioritaet"
              value={prioritaet}
              onChange={(e) => setPrioritaet(e.target.value)}
            >
              <option value="NIEDRIG">Niedrig</option>
              <option value="NORMAL">Normal</option>
              <option value="HOCH">Hoch</option>
              <option value="KRITISCH">Kritisch</option>
            </Select>
          </div>

          {/* Fälligkeit */}
          <div className="space-y-2">
            <Label htmlFor="faelligAm">Fälligkeit</Label>
            <Input
              id="faelligAm"
              type="date"
              value={faelligAm}
              onChange={(e) => setFaelligAm(e.target.value)}
            />
          </div>

          {/* Verantwortlich */}
          <div className="space-y-2">
            <Label htmlFor="verantwortlich">Verantwortlich</Label>
            <Select
              id="verantwortlich"
              value={verantwortlichId}
              onChange={(e) => setVerantwortlichId(e.target.value)}
            >
              <option value="">– Niemand –</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.id}
                </option>
              ))}
            </Select>
          </div>

          {/* Akte */}
          <div className="space-y-2">
            <Label htmlFor="akte">Akte</Label>
            <Select
              id="akte"
              value={akteId}
              onChange={(e) => setAkteId(e.target.value)}
            >
              <option value="">– Keine Akte –</option>
              {akten.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.aktenzeichen}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <Label>Tags</Label>
          <TicketTagInput tags={tags} onChange={setTags} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Ticket erstellen
          </Button>
          <Link href="/tickets">
            <Button type="button" variant="ghost">
              Abbrechen
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
