"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2 } from "lucide-react";

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Client-side validation
    if (!PASSWORD_REGEX.test(newPassword)) {
      setError(
        "Passwort muss mindestens 8 Zeichen, 1 Grossbuchstabe und 1 Zahl enthalten."
      );
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setError("Passwoerter stimmen nicht ueberein.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/portal/password-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          newPasswordConfirm,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Ein Fehler ist aufgetreten.");
      } else {
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setNewPasswordConfirm("");
      }
    } catch {
      setError("Verbindungsfehler. Bitte versuchen Sie es spaeter erneut.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card rounded-xl p-6">
      <h2 className="text-lg font-heading text-foreground mb-4">
        Passwort aendern
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="currentPassword"
            className="block text-sm font-medium text-muted-foreground mb-1.5"
          >
            Aktuelles Passwort
          </label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="********"
          />
        </div>

        <div>
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium text-muted-foreground mb-1.5"
          >
            Neues Passwort
          </label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="********"
          />
        </div>

        <div>
          <label
            htmlFor="newPasswordConfirm"
            className="block text-sm font-medium text-muted-foreground mb-1.5"
          >
            Neues Passwort bestaetigen
          </label>
          <Input
            id="newPasswordConfirm"
            type="password"
            autoComplete="new-password"
            required
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
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

        {success && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Passwort erfolgreich geaendert.
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Wird gespeichert..." : "Passwort aendern"}
        </Button>
      </form>
    </div>
  );
}
