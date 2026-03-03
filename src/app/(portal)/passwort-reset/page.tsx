"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function PasswortResetPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mesh">
        <div className="w-full max-w-md mx-4">
          <div className="glass-lg rounded-2xl p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-heading text-foreground mb-2">
              Ungueltiger Link
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Bitte verwenden Sie den Link aus Ihrer E-Mail.
            </p>
            <Link href="/portal/login">
              <Button variant="outline" className="w-full">
                Zur Anmeldung
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mesh">
        <div className="w-full max-w-md mx-4">
          <div className="glass-lg rounded-2xl p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-xl font-heading text-foreground mb-2">
              Passwort geaendert
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Ihr Passwort wurde erfolgreich geaendert. Sie koennen sich jetzt
              mit Ihrem neuen Passwort anmelden.
            </p>
            <Link href="/portal/login">
              <Button className="w-full">Zur Anmeldung</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("Passwoerter stimmen nicht ueberein.");
      return;
    }

    if (!PASSWORD_REGEX.test(password)) {
      setError(
        "Passwort muss mindestens 8 Zeichen, 1 Grossbuchstabe und 1 Zahl enthalten."
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/portal/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, passwordConfirm }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Ein Fehler ist aufgetreten.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Verbindungsfehler. Bitte versuchen Sie es spaeter erneut.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mesh">
      <div className="w-full max-w-md mx-4">
        <div className="glass-lg rounded-2xl p-8">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600 rounded-xl mb-4 shadow-lg shadow-brand-600/25">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-heading text-foreground">
              Neues Passwort setzen
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Geben Sie Ihr neues Passwort ein.
            </p>
          </div>

          {/* Reset Confirm Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground/80 mb-1.5"
              >
                Neues Passwort
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
              />
            </div>

            <div>
              <label
                htmlFor="passwordConfirm"
                className="block text-sm font-medium text-foreground/80 mb-1.5"
              >
                Passwort bestaetigen
              </label>
              <Input
                id="passwordConfirm"
                type="password"
                autoComplete="new-password"
                required
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="********"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Mindestens 8 Zeichen, 1 Grossbuchstabe, 1 Zahl
            </p>

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Wird gespeichert..." : "Neues Passwort setzen"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
