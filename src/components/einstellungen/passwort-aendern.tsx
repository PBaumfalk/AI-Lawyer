"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { KeyRound } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORT_LAENGE, eigenesPasswortSchema } from "@/lib/benutzer/schema";

export function PasswortAendern() {
  const [aktuell, setAktuell] = useState("");
  const [neu, setNeu] = useState("");
  const [wiederholt, setWiederholt] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    if (neu !== wiederholt) {
      setFehler("Die beiden neuen Passwörter stimmen nicht überein");
      return;
    }
    const geprueft = eigenesPasswortSchema.safeParse({ aktuell, neu });
    if (!geprueft.success) {
      setFehler(geprueft.error.issues[0]?.message ?? "Ungültige Eingabe");
      return;
    }
    setLaeuft(true);
    const res = await fetch("/api/user/passwort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geprueft.data),
    });
    const body = await res.json().catch(() => null);
    setLaeuft(false);
    if (!res.ok) {
      setFehler(body?.error ?? "Passwort konnte nicht geändert werden");
      return;
    }
    // Alle Sitzungen dieses Kontos sind jetzt ungültig, auch diese.
    await signOut({ callbackUrl: "/login?passwort=geaendert" });
  }

  return (
    <GlassCard className="p-6">
      <h2 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
        <KeyRound className="w-4 h-4" /> Passwort ändern
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Mindestens {MIN_PASSWORT_LAENGE} Zeichen. Danach melden Sie sich neu an; andere angemeldete Geräte werden
        abgemeldet.
      </p>
      <form onSubmit={absenden} className="grid gap-3 max-w-md">
        <div className="space-y-1.5">
          <Label htmlFor="pw-aktuell">Aktuelles Passwort</Label>
          <Input id="pw-aktuell" type="password" autoComplete="current-password" required
            value={aktuell} onChange={(e) => setAktuell(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-neu">Neues Passwort</Label>
          <Input id="pw-neu" type="password" autoComplete="new-password" required minLength={MIN_PASSWORT_LAENGE}
            value={neu} onChange={(e) => setNeu(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-wdh">Neues Passwort wiederholen</Label>
          <Input id="pw-wdh" type="password" autoComplete="new-password" required
            value={wiederholt} onChange={(e) => setWiederholt(e.target.value)} />
        </div>
        {fehler && <p role="alert" className="text-sm text-rose-600">{fehler}</p>}
        <div>
          <Button type="submit" disabled={laeuft}>{laeuft ? "Speichere…" : "Passwort ändern"}</Button>
        </div>
      </form>
    </GlassCard>
  );
}
