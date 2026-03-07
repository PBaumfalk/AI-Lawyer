"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/ui/glass-card";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Copy,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Status =
  | "loading"
  | "disabled"
  | "setup"
  | "verify"
  | "backup-codes-display"
  | "enabled";

// ─── Component ───────────────────────────────────────────────────────────────

export function ZweiFaktorTab() {
  const [status, setStatus] = useState<Status>("loading");
  const [backupCodeCount, setBackupCodeCount] = useState(0);

  // Setup flow
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Backup codes returned after activation or regeneration
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Inline confirm: regenerate backup codes
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [regenCode, setRegenCode] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenNewCodes, setRegenNewCodes] = useState<string[]>([]);

  // Inline confirm: disable 2FA
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);

  // ─── Load initial status ────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/user/totp-status")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data.totpEnabled ? "enabled" : "disabled");
        setBackupCodeCount(data.backupCodeCount ?? 0);
      })
      .catch(() => {
        toast.error("2FA-Status konnte nicht geladen werden");
        setStatus("disabled");
      });
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────────────

  async function handleActivate() {
    setSetupLoading(true);
    try {
      const res = await fetch("/api/auth/totp/setup", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Fehler beim Starten der 2FA-Einrichtung");
      }
      const data = await res.json();
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setSecret(data.secret);
      setSetupCode("");
      setStatus("setup");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleVerifySetup() {
    if (setupCode.length !== 6) {
      toast.error("Bitte geben Sie einen 6-stelligen Code ein");
      return;
    }
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/auth/totp/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: setupCode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Code konnte nicht verifiziert werden");
      }
      const data = await res.json();
      setBackupCodes(data.backupCodes ?? []);
      setStatus("backup-codes-display");
      toast.success("2FA erfolgreich aktiviert");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setVerifyLoading(false);
    }
  }

  function handleBackupCodesDone() {
    setStatus("enabled");
    setBackupCodeCount(backupCodes.length);
    setBackupCodes([]);
  }

  async function handleRegenBackupCodes() {
    if (regenCode.length !== 6) {
      toast.error("Bitte geben Sie einen 6-stelligen Code ein");
      return;
    }
    setRegenLoading(true);
    try {
      const res = await fetch("/api/auth/totp/backup-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: regenCode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Backup-Codes konnten nicht neu generiert werden");
      }
      const data = await res.json();
      setRegenNewCodes(data.backupCodes ?? []);
      setBackupCodeCount(data.backupCodes?.length ?? 0);
      setRegenCode("");
      setShowRegenConfirm(false);
      toast.success("Backup-Codes wurden neu generiert");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setRegenLoading(false);
    }
  }

  async function handleDisable() {
    if (disableCode.length !== 6) {
      toast.error("Bitte geben Sie einen 6-stelligen Code ein");
      return;
    }
    setDisableLoading(true);
    try {
      const res = await fetch("/api/auth/totp/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: disableCode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "2FA konnte nicht deaktiviert werden");
      }
      setStatus("disabled");
      setShowDisableConfirm(false);
      setDisableCode("");
      setRegenNewCodes([]);
      toast.success("2FA wurde deaktiviert");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setDisableLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("In Zwischenablage kopiert"))
      .catch(() => toast.error("Konnte nicht kopiert werden"));
  }

  // ─── Render helpers ──────────────────────────────────────────────────────

  function renderLoading() {
    return (
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Lade 2FA-Status...</span>
        </div>
      </GlassCard>
    );
  }

  function renderDisabled() {
    return (
      <GlassCard className="p-6">
        <div className="flex items-start gap-4">
          <Shield className="w-8 h-8 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground mb-1">
              Zwei-Faktor-Authentifizierung
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Zwei-Faktor-Authentifizierung schützt Ihr Konto, indem bei der
              Anmeldung zusätzlich ein Einmalcode aus einer Authenticator-App
              verlangt wird.
            </p>
            <Button
              onClick={handleActivate}
              disabled={setupLoading}
              className="bg-brand-600 hover:bg-brand-700 text-white"
            >
              {setupLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Shield className="w-4 h-4 mr-2" />
              )}
              2FA aktivieren
            </Button>
          </div>
        </div>
      </GlassCard>
    );
  }

  function renderSetup() {
    return (
      <GlassCard className="p-6 space-y-6">
        <div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            Authenticator-App einrichten
          </h3>
          <p className="text-sm text-muted-foreground">
            Scannen Sie den QR-Code mit Ihrer Authenticator-App (z.B. Google
            Authenticator, Authy oder 1Password).
          </p>
        </div>

        {/* QR code */}
        {qrCodeDataUrl && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrCodeDataUrl}
              alt="TOTP QR Code"
              className="w-48 h-48 rounded-lg border border-white/10"
            />
          </div>
        )}

        {/* Manual secret */}
        {secret && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Oder manuell eingeben:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-black/10 dark:bg-white/5 px-3 py-2 rounded-md break-all select-all">
                {secret}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(secret)}
                className="shrink-0"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Code input */}
        <div className="space-y-2">
          <label
            htmlFor="totp-setup-code"
            className="text-sm font-medium text-foreground"
          >
            Code aus Authenticator-App eingeben
          </label>
          <div className="flex gap-2">
            <Input
              id="totp-setup-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={setupCode}
              onChange={(e) =>
                setSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="font-mono text-lg tracking-widest w-36"
            />
            <Button
              onClick={handleVerifySetup}
              disabled={verifyLoading || setupCode.length !== 6}
            >
              {verifyLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Bestätigen
            </Button>
          </div>
        </div>
      </GlassCard>
    );
  }

  function renderBackupCodesDisplay() {
    return (
      <GlassCard className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              Backup-Codes speichern
            </h3>
            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
              Diese Codes werden nur einmal angezeigt. Speichern Sie sie sicher.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {backupCodes.map((code, i) => (
            <div
              key={i}
              className="font-mono text-sm bg-black/10 dark:bg-white/5 px-3 py-2 rounded-md text-center select-all"
            >
              {code}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(backupCodes.join("\n"))}
          >
            <Copy className="w-4 h-4 mr-2" />
            Alle kopieren
          </Button>
          <Button onClick={handleBackupCodesDone} className="ml-auto">
            <CheckCircle className="w-4 h-4 mr-2" />
            Fertig
          </Button>
        </div>
      </GlassCard>
    );
  }

  function renderEnabled() {
    return (
      <div className="space-y-4">
        {/* Status badge */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-green-500 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  Zwei-Faktor-Authentifizierung
                </h3>
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  2FA aktiv
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Ihr Konto ist durch Zwei-Faktor-Authentifizierung geschützt.
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Backup codes management */}
        <GlassCard className="p-6 space-y-4">
          <h3 className="text-base font-semibold text-foreground">
            Backup-Codes verwalten
          </h3>
          <p className="text-sm text-muted-foreground">
            {backupCodeCount > 0
              ? `Sie haben noch ${backupCodeCount} Backup-Code${backupCodeCount === 1 ? "" : "s"} verfügbar.`
              : "Keine Backup-Codes mehr verfügbar. Bitte generieren Sie neue."}
          </p>

          {/* Show new codes after regen */}
          {regenNewCodes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                  Neue Backup-Codes — nur einmal angezeigt. Speichern Sie sie
                  jetzt.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {regenNewCodes.map((code, i) => (
                  <div
                    key={i}
                    className="font-mono text-sm bg-black/10 dark:bg-white/5 px-3 py-2 rounded-md text-center select-all"
                  >
                    {code}
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(regenNewCodes.join("\n"))}
              >
                <Copy className="w-4 h-4 mr-2" />
                Alle kopieren
              </Button>
            </div>
          )}

          {!showRegenConfirm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowRegenConfirm(true);
                setRegenCode("");
              }}
            >
              Backup-Codes neu generieren
            </Button>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Aktuellen TOTP-Code eingeben zur Bestätigung
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={regenCode}
                  onChange={(e) =>
                    setRegenCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="font-mono text-lg tracking-widest w-36"
                />
                <Button
                  size="sm"
                  onClick={handleRegenBackupCodes}
                  disabled={regenLoading || regenCode.length !== 6}
                >
                  {regenLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Bestätigen
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowRegenConfirm(false);
                    setRegenCode("");
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Disable 2FA */}
        <GlassCard className="p-6 space-y-4">
          <h3 className="text-base font-semibold text-foreground">
            2FA deaktivieren
          </h3>
          <p className="text-sm text-muted-foreground">
            Deaktivieren Sie die Zwei-Faktor-Authentifizierung für Ihr Konto.
            Sie können sie jederzeit wieder aktivieren.
          </p>

          {!showDisableConfirm ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setShowDisableConfirm(true);
                setDisableCode("");
              }}
            >
              <ShieldOff className="w-4 h-4 mr-2" />
              2FA deaktivieren
            </Button>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Aktuellen TOTP-Code eingeben zur Bestätigung
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={disableCode}
                  onChange={(e) =>
                    setDisableCode(
                      e.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  className="font-mono text-lg tracking-widest w-36"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDisable}
                  disabled={disableLoading || disableCode.length !== 6}
                >
                  {disableLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Deaktivieren bestätigen
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowDisableConfirm(false);
                    setDisableCode("");
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {status === "loading" && renderLoading()}
      {status === "disabled" && renderDisabled()}
      {status === "setup" && renderSetup()}
      {status === "backup-codes-display" && renderBackupCodesDisplay()}
      {status === "enabled" && renderEnabled()}
    </div>
  );
}
