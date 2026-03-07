"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Scale } from "lucide-react";

export default function TotpChallengePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);

  // If there is no totp_pending cookie the user should not be here
  useEffect(() => {
    const hasPendingCookie = document.cookie
      .split(";")
      .some((c) => c.trim().startsWith("totp_pending="));
    if (!hasPendingCookie) {
      router.push("/login");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/totp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, isBackupCode: useBackupCode }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      setLoading(false);
      setError(data.error ?? "Ungültiger Code. Bitte erneut versuchen.");
      return;
    }

    // Verify route returns { success: true, nonce, email }
    // Use the nonce as the "password" so auth.ts authorize can create the session
    const result = await signIn("credentials", {
      email: data.email,
      password: `TOTP:${data.nonce}`,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Anmeldung fehlgeschlagen. Bitte erneut versuchen.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mesh">
      <div className="w-full max-w-md mx-4">
        <div className="glass-lg rounded-2xl p-8">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600 rounded-xl mb-4 shadow-lg shadow-brand-600/25">
              <Scale className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-heading text-foreground">
              Zwei-Faktor-Authentifizierung
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {useBackupCode
                ? "Geben Sie einen Ihrer Backup-Codes ein"
                : "Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein"}
            </p>
          </div>

          {/* TOTP Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="code"
                className="block text-sm font-medium text-foreground/80 mb-1.5"
              >
                {useBackupCode ? "Backup-Code" : "Authentifizierungscode"}
              </label>
              {useBackupCode ? (
                <Input
                  id="code"
                  name="code"
                  type="text"
                  autoComplete="one-time-code"
                  required
                  placeholder="xxxx-xxxx"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              ) : (
                <Input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]*"
                  required
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              )}
            </div>

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Wird geprüft..." : "Code bestätigen"}
            </Button>
          </form>

          {/* Toggle between TOTP and backup code */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setUseBackupCode((prev) => !prev);
                setCode("");
                setError(null);
              }}
              className="text-sm text-brand-600 hover:text-brand-700 underline underline-offset-2"
            >
              {useBackupCode
                ? "Authenticator-Code verwenden"
                : "Backup-Code verwenden"}
            </button>
          </div>

          {/* Back to login */}
          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Zuruck zur Anmeldung
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
