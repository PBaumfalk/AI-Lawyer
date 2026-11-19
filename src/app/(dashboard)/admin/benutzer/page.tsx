"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, LockOpen, Plus, ShieldCheck, UserRound } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  KANZLEI_ROLLEN,
  ROLLEN_LABEL,
  type BenutzerAendern,
  type BenutzerAnlegen,
  type BenutzerZeile,
  type KanzleiRolle,
  type StartpasswortAntwort,
} from "@/lib/benutzer/schema";

async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    ...(json !== undefined ? { body: JSON.stringify(json), headers: { "Content-Type": "application/json" } } : {}),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Fehler ${res.status}`);
  return body as T;
}

export default function BenutzerPage() {
  const [benutzer, setBenutzer] = useState<BenutzerZeile[] | null>(null);
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [anlegenOffen, setAnlegenOffen] = useState(false);
  const [zuruecksetzen, setZuruecksetzen] = useState<BenutzerZeile | null>(null);
  const [startpasswort, setStartpasswort] = useState<{ email: string; passwort: string } | null>(null);

  const laden = useCallback(async () => {
    try {
      setBenutzer(await api<BenutzerZeile[]>("/api/admin/benutzer"));
      setLadefehler(null);
    } catch (e) {
      setLadefehler((e as Error).message);
    }
  }, []);

  useEffect(() => {
    laden();
  }, [laden]);

  async function aendern(u: BenutzerZeile, aenderung: BenutzerAendern) {
    try {
      const neu = await api<BenutzerZeile>(`/api/admin/benutzer/${u.id}`, { method: "PATCH", json: aenderung });
      setBenutzer((alt) => alt?.map((x) => (x.id === neu.id ? neu : x)) ?? null);
      toast.success(`${neu.name} gespeichert`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function entsperren(u: BenutzerZeile) {
    try {
      await api(`/api/admin/benutzer/${u.id}/entsperren`, { method: "POST" });
      toast.success(`Anmeldesperre für ${u.name} aufgehoben`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const aktive = benutzer?.filter((b) => b.aktiv).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Benutzer</h1>
          <p className="text-muted-foreground mt-1">
            Konten für Mitarbeitende anlegen, Rollen vergeben, Zugänge sperren und Passwörter zurücksetzen.
            {benutzer && ` ${aktive} aktiv, ${benutzer.length - aktive} deaktiviert.`}
          </p>
        </div>
        <Button onClick={() => setAnlegenOffen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Neues Konto
        </Button>
      </div>

      {ladefehler ? (
        <GlassPanel elevation="panel" className="p-6 text-rose-600">
          Benutzer konnten nicht geladen werden: {ladefehler}{" "}
          <Button variant="link" onClick={laden}>Erneut versuchen</Button>
        </GlassPanel>
      ) : benutzer === null ? (
        <div className="text-center py-12 text-muted-foreground">Lade Benutzer…</div>
      ) : (
        <GlassPanel elevation="panel" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border/50">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Rolle</th>
                <th className="px-4 py-3 font-medium">Position</th>
                <th className="px-4 py-3 font-medium">Zwei-Faktor</th>
                <th className="px-4 py-3 font-medium">Aktiv</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {benutzer.map((u) => (
                <tr key={u.id} className={`border-b border-border/30 ${u.aktiv ? "" : "opacity-60"}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserRound className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <div className="font-medium text-foreground">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 min-w-[11rem]">
                    <Select
                      aria-label={`Rolle von ${u.name}`}
                      value={u.role}
                      onChange={(e) => aendern(u, { role: e.target.value as KanzleiRolle })}
                    >
                      {KANZLEI_ROLLEN.map((r) => (
                        <option key={r} value={r}>{ROLLEN_LABEL[r]}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.position ?? "–"}</td>
                  <td className="px-4 py-3">
                    {u.totpEnabled ? (
                      <Badge variant="success"><ShieldCheck className="w-3 h-3 mr-1" />aktiv</Badge>
                    ) : (
                      <Badge variant="muted">aus</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Switch
                      aria-label={`${u.name} ${u.aktiv ? "deaktivieren" : "aktivieren"}`}
                      checked={u.aktiv}
                      onCheckedChange={(v) => aendern(u, { aktiv: v })}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => entsperren(u)}
                        title="Hebt eine Sperre nach zu vielen Fehlversuchen auf. Passwort und Sitzungen bleiben unverändert."
                      >
                        <LockOpen className="w-4 h-4 mr-1.5" />
                        Entsperren
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setZuruecksetzen(u)}>
                        <KeyRound className="w-4 h-4 mr-1.5" />
                        Passwort zurücksetzen
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassPanel>
      )}

      <p className="text-xs text-muted-foreground">
        Deaktivieren und Rollenwechsel wirken sofort, auch auf bereits angemeldete Sitzungen. Mandantenkonten
        entstehen über die Portal-Einladung in der Akte.
      </p>

      <AnlegenDialog
        offen={anlegenOffen}
        onSchliessen={() => setAnlegenOffen(false)}
        onAngelegt={(r) => {
          setAnlegenOffen(false);
          setBenutzer((alt) => [...(alt ?? []), r.benutzer]);
          if (r.startpasswort) setStartpasswort({ email: r.benutzer.email, passwort: r.startpasswort });
          else toast.success(`${r.benutzer.name} angelegt`);
        }}
      />

      <ZuruecksetzenDialog
        benutzer={zuruecksetzen}
        onSchliessen={() => setZuruecksetzen(null)}
        onFertig={(r) => {
          setZuruecksetzen(null);
          setBenutzer((alt) => alt?.map((x) => (x.id === r.benutzer.id ? r.benutzer : x)) ?? null);
          if (r.startpasswort) setStartpasswort({ email: r.benutzer.email, passwort: r.startpasswort });
        }}
      />

      <Dialog open={!!startpasswort} onOpenChange={(o) => !o && setStartpasswort(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Startpasswort</DialogTitle>
            <DialogDescription>
              Nur jetzt sichtbar. Geben Sie es persönlich weiter; die Person ändert es nach der ersten Anmeldung
              unter Einstellungen → Sicherheit.
            </DialogDescription>
          </DialogHeader>
          {startpasswort && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">{startpasswort.email}</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg glass-input px-3 py-2 font-mono text-base tracking-wide select-all">
                  {startpasswort.passwort}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Passwort kopieren"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(startpasswort.passwort)
                      .then(() => toast.success("Kopiert"))
                      .catch(() => toast.error("Kopieren nicht möglich – bitte markieren und kopieren"))
                  }
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setStartpasswort(null)}>Fertig</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnlegenDialog({
  offen,
  onSchliessen,
  onAngelegt,
}: {
  offen: boolean;
  onSchliessen: () => void;
  onAngelegt: (_antwort: StartpasswortAntwort) => void;
}) {
  const leer: BenutzerAnlegen = { email: "", name: "", role: "SACHBEARBEITER", position: "" };
  const [daten, setDaten] = useState<BenutzerAnlegen>(leer);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    if (offen) {
      setDaten(leer);
      setFehler(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen]);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler(null);
    try {
      onAngelegt(await api<StartpasswortAntwort>("/api/admin/benutzer", { method: "POST", json: daten }));
    } catch (err) {
      setFehler((err as Error).message);
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Dialog open={offen} onOpenChange={(o) => !o && onSchliessen()}>
      <DialogContent>
        <form onSubmit={absenden} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Neues Konto</DialogTitle>
            <DialogDescription>Das Startpasswort wird erzeugt und einmalig angezeigt.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="b-name">Name</Label>
            <Input id="b-name" required autoFocus value={daten.name}
              onChange={(e) => setDaten({ ...daten, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-email">E-Mail (Anmeldename)</Label>
            <Input id="b-email" type="email" required autoComplete="off" value={daten.email}
              onChange={(e) => setDaten({ ...daten, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-rolle">Rolle</Label>
              <Select id="b-rolle" value={daten.role}
                onChange={(e) => setDaten({ ...daten, role: e.target.value as KanzleiRolle })}>
                {KANZLEI_ROLLEN.map((r) => (
                  <option key={r} value={r}>{ROLLEN_LABEL[r]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-position">Position (optional)</Label>
              <Input id="b-position" placeholder="z. B. ReFa" value={daten.position ?? ""}
                onChange={(e) => setDaten({ ...daten, position: e.target.value })} />
            </div>
          </div>
          {fehler && <p role="alert" className="text-sm text-rose-600">{fehler}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onSchliessen}>Abbrechen</Button>
            <Button type="submit" disabled={laeuft}>{laeuft ? "Lege an…" : "Konto anlegen"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ZuruecksetzenDialog({
  benutzer,
  onSchliessen,
  onFertig,
}: {
  benutzer: BenutzerZeile | null;
  onSchliessen: () => void;
  onFertig: (_antwort: StartpasswortAntwort) => void;
}) {
  const [totp, setTotp] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    setTotp(false);
    setFehler(null);
  }, [benutzer]);

  async function bestaetigen() {
    if (!benutzer) return;
    setLaeuft(true);
    try {
      onFertig(
        await api<StartpasswortAntwort>(`/api/admin/benutzer/${benutzer.id}/passwort`, {
          method: "POST",
          json: { totpZuruecksetzen: totp },
        })
      );
    } catch (e) {
      setFehler((e as Error).message);
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Dialog open={!!benutzer} onOpenChange={(o) => !o && onSchliessen()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Passwort zurücksetzen</DialogTitle>
          <DialogDescription>
            {benutzer?.name} erhält ein neues Startpasswort. Alle laufenden Sitzungen dieses Kontos werden beendet
            und eine Anmeldesperre nach Fehlversuchen wird aufgehoben.
          </DialogDescription>
        </DialogHeader>
        {benutzer?.totpEnabled && (
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={totp} onCheckedChange={setTotp} />
            Zwei-Faktor-Anmeldung ebenfalls zurücksetzen (Gerät verloren)
          </label>
        )}
        {fehler && <p role="alert" className="text-sm text-rose-600">{fehler}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onSchliessen}>Abbrechen</Button>
          <Button variant="destructive" onClick={bestaetigen} disabled={laeuft}>
            {laeuft ? "Setze zurück…" : "Neues Passwort erzeugen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
