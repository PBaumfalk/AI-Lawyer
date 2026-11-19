"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileKey2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Mirrors the GET/POST response of /api/admin/benutzer/[id]/bea-zertifikat (dates as ISO strings)
interface ZertifikatInfo {
  seriennummer: string;
  inhaber: string;
  gueltigBis: string;
  status: "AKTIV" | "FEHLER";
  letzterFehler: string | null;
  letzterAbruf: string | null;
  safeId: string | null;
}

async function anfrage(url: string, init?: RequestInit): Promise<{ zertifikat?: ZertifikatInfo | null }> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Fehler ${res.status}`);
  return body ?? {};
}

function datum(iso: string | null, mitZeit = false): string {
  if (!iso) return "–";
  const d = new Date(iso);
  return mitZeit ? d.toLocaleString("de-DE") : d.toLocaleDateString("de-DE");
}

export function BeaZertifikatDialog({
  benutzer,
  onSchliessen,
}: {
  benutzer: { id: string; name: string } | null;
  onSchliessen: () => void;
}) {
  const [info, setInfo] = useState<ZertifikatInfo | null | undefined>(undefined);
  const [datei, setDatei] = useState<File | null>(null);
  const [pin, setPin] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const dateiFeld = useRef<HTMLInputElement>(null);

  const url = benutzer ? `/api/admin/benutzer/${benutzer.id}/bea-zertifikat` : null;

  useEffect(() => {
    setInfo(undefined);
    setDatei(null);
    setPin("");
    setFehler(null);
    if (!url) return;
    let abgebrochen = false;
    anfrage(url)
      .then((r) => !abgebrochen && setInfo(r.zertifikat ?? null))
      .catch((e) => !abgebrochen && setFehler((e as Error).message));
    return () => {
      abgebrochen = true;
    };
  }, [url]);

  async function hochladen(e: React.FormEvent) {
    e.preventDefault();
    if (!url || !datei) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const form = new FormData();
      form.set("datei", datei);
      form.set("pin", pin);
      const r = await anfrage(url, { method: "POST", body: form });
      setInfo(r.zertifikat ?? null);
      setDatei(null);
      setPin("");
      if (dateiFeld.current) dateiFeld.current.value = "";
      toast.success("beA-Zertifikat hinterlegt");
    } catch (err) {
      setFehler((err as Error).message);
    } finally {
      setLaeuft(false);
    }
  }

  async function entfernen() {
    if (!url) return;
    setLaeuft(true);
    setFehler(null);
    try {
      await anfrage(url, { method: "DELETE" });
      setInfo(null);
      toast.success("beA-Zertifikat entfernt");
    } catch (err) {
      setFehler((err as Error).message);
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Dialog open={!!benutzer} onOpenChange={(o) => !o && onSchliessen()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>beA-Zertifikat</DialogTitle>
          <DialogDescription>
            Softwarezertifikat für {benutzer?.name}. Das beA-Softwarezertifikat erhalten Sie bei der
            Bundesnotarkammer.
          </DialogDescription>
        </DialogHeader>

        {info === undefined && !fehler ? (
          <p className="text-sm text-muted-foreground">Lade Zertifikat…</p>
        ) : info ? (
          <div className="space-y-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Inhaber</dt>
              <dd className="font-medium">{info.inhaber}</dd>
              <dt className="text-muted-foreground">Seriennummer</dt>
              <dd className="font-mono text-xs self-center break-all">{info.seriennummer}</dd>
              <dt className="text-muted-foreground">Gültig bis</dt>
              <dd>{datum(info.gueltigBis)}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                {info.status === "AKTIV" ? (
                  <Badge variant="success">aktiv</Badge>
                ) : (
                  <Badge variant="destructive">Fehler</Badge>
                )}
              </dd>
              {info.letzterFehler && (
                <>
                  <dt className="text-muted-foreground">Letzter Fehler</dt>
                  <dd className="text-destructive">{info.letzterFehler}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Letzter Abruf</dt>
              <dd>{datum(info.letzterAbruf, true)}</dd>
            </dl>
            <Button variant="destructive" size="sm" onClick={entfernen} disabled={laeuft}>
              <Trash2 className="w-4 h-4 mr-1.5" />
              Zertifikat entfernen
            </Button>
          </div>
        ) : info === null ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <FileKey2 className="w-4 h-4 shrink-0" />
            Noch kein Zertifikat hinterlegt.
          </p>
        ) : null}

        <form onSubmit={hochladen} className="space-y-3 border-t border-border/50 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="bea-datei">{info ? "Neues Zertifikat (.p12 oder .pfx)" : "Zertifikatsdatei (.p12 oder .pfx)"}</Label>
            <Input
              id="bea-datei"
              ref={dateiFeld}
              type="file"
              accept=".p12,.pfx,application/x-pkcs12"
              required
              onChange={(e) => setDatei(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bea-pin">PIN</Label>
            <Input
              id="bea-pin"
              type="password"
              autoComplete="off"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>
          {fehler && <p role="alert" className="text-sm text-destructive">{fehler}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onSchliessen}>Schließen</Button>
            <Button type="submit" disabled={laeuft || !datei || !pin}>
              <Upload className="w-4 h-4 mr-1.5" />
              {laeuft ? "Prüfe…" : "Zertifikat hinterlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
