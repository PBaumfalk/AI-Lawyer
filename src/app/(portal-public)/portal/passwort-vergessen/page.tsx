"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Mail } from "lucide-react";
import Link from "next/link";

export default function PasswortVergessenPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch("/api/portal/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // Ignore errors -- always show success message
    }

    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mesh">
        <div className="w-full max-w-md mx-4">
          <div className="glass-lg rounded-2xl p-8 text-center">
            <Mail className="w-12 h-12 text-brand-500 mx-auto mb-4" />
            <h1 className="text-xl font-heading text-foreground mb-2">
              E-Mail gesendet
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Falls ein Account mit dieser E-Mail existiert, erhalten Sie in
              Kürze eine E-Mail mit Anweisungen zum Zurücksetzen Ihres
              Passworts.
            </p>
            <Link href="/portal/login">
              <Button variant="outline" className="w-full">
                Zurück zur Anmeldung
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mesh">
      <div className="w-full max-w-md mx-4">
        <div className="glass-lg rounded-2xl p-8">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
              <Shield className="w-7 h-7" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-heading text-foreground">
              Passwort vergessen
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Geben Sie Ihre E-Mail-Adresse ein, um Ihr Passwort
              zurückzusetzen.
            </p>
          </div>

          {/* Reset Request Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground/80 mb-1.5"
              >
                E-Mail-Adresse
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mandant@beispiel.de"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Wird gesendet..." : "Zurücksetzen"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link
              href="/portal/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Zurück zur Anmeldung
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
