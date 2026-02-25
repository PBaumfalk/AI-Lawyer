"use client";

import { BeaSessionProvider, useBeaSession } from "@/lib/bea/session";
import { BeaInbox } from "@/components/bea/bea-inbox";
import { useSession } from "next-auth/react";
import { useState, useRef } from "react";
import {
  Shield,
  Upload,
  LogOut,
  Clock,
  Loader2,
  AlertCircle,
  Plus,
} from "lucide-react";
import Link from "next/link";

function BeaPageContent() {
  const { data: authSession } = useSession();
  const {
    isAuthenticated,
    session: beaSession,
    isLoading,
    error,
    login,
    logout,
    remainingTime,
  } = useBeaSession();

  const userRole = (authSession?.user as any)?.role;
  const isAnwalt = userRole === "ANWALT";

  if (!isAuthenticated) {
    return <BeaLoginForm isLoading={isLoading} error={error} onLogin={login} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading text-foreground">beA</h1>
          <p className="text-muted-foreground mt-1">
            Besonderes elektronisches Anwaltspostfach
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAnwalt && (
            <Link
              href="/bea/compose"
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Neue Nachricht
            </Link>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4 text-emerald-500" />
            <span>Verbunden als {beaSession?.safeId || "unbekannt"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formatRemainingTime(remainingTime)}</span>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Abmelden
          </button>
        </div>
      </div>

      <BeaInbox />
    </div>
  );
}

// ─── Login Form ──────────────────────────────────────────────────────────────

function BeaLoginForm({
  isLoading,
  error,
  onLogin,
}: {
  isLoading: boolean;
  error: string | null;
  onLogin: (token: File, pin: string) => Promise<any>;
}) {
  const [pin, setPin] = useState("");
  const [tokenFile, setTokenFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenFile || !pin) return;
    await onLogin(tokenFile, pin);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading text-foreground">beA</h1>
        <p className="text-muted-foreground mt-1">
          Besonderes elektronisches Anwaltspostfach
        </p>
      </div>

      <div className="max-w-md mx-auto">
        <div className="glass rounded-xl p-8 space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand/10 mb-4">
              <Shield className="h-8 w-8 text-brand" />
            </div>
            <h2 className="text-lg font-heading text-foreground">
              beA-Anmeldung
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Melden Sie sich mit Ihrem Software-Token und Ihrer PIN an.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Software Token File */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Software-Token
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 border border-border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Upload className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate">
                  {tokenFile ? tokenFile.name : "Token-Datei auswaehlen..."}
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".p12,.pfx"
                className="hidden"
                onChange={(e) => setTokenFile(e.target.files?.[0] || null)}
              />
            </div>

            {/* PIN */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Ihre beA-PIN eingeben"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
                disabled={isLoading}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 p-3">
                <AlertCircle className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !tokenFile || !pin}
              className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Anmeldung...
                </>
              ) : (
                "Anmelden"
              )}
            </button>
          </form>

          <p className="text-xs text-muted-foreground text-center">
            Die Authentifizierung erfolgt vollstaendig im Browser.
            Ihre Schluessel verlassen niemals dieses Geraet.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return "Abgelaufen";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export default function BeaPage() {
  return (
    <BeaSessionProvider>
      <BeaPageContent />
    </BeaSessionProvider>
  );
}
