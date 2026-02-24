"use client";

import { useState, useEffect } from "react";
import { X, Save, Shield, Info } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  ProviderProfiles,
  type ProviderProfile,
} from "./provider-profiles";
import { ConnectionTest } from "./connection-test";

const mailboxSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  emailAdresse: z.string().email("Ungueltige E-Mail-Adresse"),
  benutzername: z.string().min(1, "Benutzername ist erforderlich"),
  passwort: z.string().optional(),
  authTyp: z.enum(["PASSWORT", "OAUTH2"]).default("PASSWORT"),
  imapHost: z.string().min(1, "IMAP-Host ist erforderlich"),
  imapPort: z.coerce.number().int().default(993),
  imapSecure: z.boolean().default(true),
  smtpHost: z.string().min(1, "SMTP-Host ist erforderlich"),
  smtpPort: z.coerce.number().int().default(587),
  smtpSecure: z.boolean().default(false),
  istKanzlei: z.boolean().default(false),
  initialSync: z.enum(["NUR_NEUE", "DREISSIG_TAGE", "ALLES"]).default("DREISSIG_TAGE"),
  softDeleteTage: z.coerce.number().int().min(0).default(30),
});

type MailboxFormData = z.infer<typeof mailboxSchema>;

interface MailboxFormProps {
  kontoId?: string; // If provided, editing existing mailbox
  onClose: () => void;
  onSaved: () => void;
}

export function MailboxForm({ kontoId, onClose, onSaved }: MailboxFormProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form fields
  const [form, setForm] = useState<Partial<MailboxFormData>>({
    name: "",
    emailAdresse: "",
    benutzername: "",
    passwort: "",
    authTyp: "PASSWORT",
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    istKanzlei: false,
    initialSync: "DREISSIG_TAGE",
    softDeleteTage: 30,
  });

  // Load existing data if editing
  useEffect(() => {
    if (!kontoId) return;
    fetch(`/api/email-konten/${kontoId}`)
      .then((r) => r.json())
      .then((data) => {
        setForm({
          name: data.name || "",
          emailAdresse: data.emailAdresse || "",
          benutzername: data.benutzername || "",
          passwort: "", // Never pre-fill password
          authTyp: data.authTyp || "PASSWORT",
          imapHost: data.imapHost || "",
          imapPort: data.imapPort || 993,
          imapSecure: data.imapSecure ?? true,
          smtpHost: data.smtpHost || "",
          smtpPort: data.smtpPort || 587,
          smtpSecure: data.smtpSecure ?? false,
          istKanzlei: data.istKanzlei ?? false,
          initialSync: data.initialSync || "DREISSIG_TAGE",
          softDeleteTage: data.softDeleteTage ?? 30,
        });
      })
      .catch(() => {
        toast.error("Fehler beim Laden der Postfach-Daten");
      });
  }, [kontoId]);

  const handleProviderSelect = (profile: ProviderProfile) => {
    setSelectedProvider(profile.id);
    setForm((prev) => ({
      ...prev,
      imapHost: profile.imapHost,
      imapPort: profile.imapPort,
      imapSecure: profile.imapSecure,
      smtpHost: profile.smtpHost,
      smtpPort: profile.smtpPort,
      smtpSecure: profile.smtpSecure,
    }));
  };

  const updateField = <K extends keyof MailboxFormData>(
    field: K,
    value: MailboxFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  };

  const handleSubmit = async () => {
    const result = mailboxSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    try {
      const url = kontoId
        ? `/api/email-konten/${kontoId}`
        : "/api/email-konten";
      const method = kontoId ? "PATCH" : "POST";

      const payload: any = { ...result.data };
      // Only send password if changed
      if (!payload.passwort) {
        delete payload.passwort;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Fehler beim Speichern");
        return;
      }

      toast.success(
        kontoId
          ? "Postfach erfolgreich aktualisiert"
          : "Neues Postfach erstellt"
      );
      onSaved();
      onClose();
    } catch {
      toast.error("Netzwerkfehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-white/20 dark:border-white/[0.08] w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 dark:border-white/[0.06]">
          <h2 className="text-lg font-heading text-foreground">
            {kontoId ? "Postfach bearbeiten" : "Neues Postfach hinzufuegen"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-white/20 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Provider selection */}
          {!kontoId && (
            <ProviderProfiles
              selectedId={selectedProvider}
              onSelect={handleProviderSelect}
            />
          )}

          {/* Section: Allgemein */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground border-b border-white/10 dark:border-white/[0.06] pb-2">
              Allgemein
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name || ""}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="z.B. Kanzlei Hauptpostfach"
                  className="w-full px-3 py-2 text-sm bg-transparent border border-white/20 dark:border-white/[0.08] rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand-500"
                />
                {errors.name && (
                  <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  E-Mail-Adresse
                </label>
                <input
                  type="email"
                  value={form.emailAdresse || ""}
                  onChange={(e) =>
                    updateField("emailAdresse", e.target.value)
                  }
                  placeholder="info@kanzlei.de"
                  className="w-full px-3 py-2 text-sm bg-transparent border border-white/20 dark:border-white/[0.08] rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand-500"
                />
                {errors.emailAdresse && (
                  <p className="text-xs text-red-500 mt-0.5">
                    {errors.emailAdresse}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Benutzername
                </label>
                <input
                  type="text"
                  value={form.benutzername || ""}
                  onChange={(e) =>
                    updateField("benutzername", e.target.value)
                  }
                  placeholder="Oft identisch mit E-Mail"
                  className="w-full px-3 py-2 text-sm bg-transparent border border-white/20 dark:border-white/[0.08] rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand-500"
                />
                {errors.benutzername && (
                  <p className="text-xs text-red-500 mt-0.5">
                    {errors.benutzername}
                  </p>
                )}
              </div>

              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.istKanzlei || false}
                    onChange={(e) =>
                      updateField("istKanzlei", e.target.checked)
                    }
                    className="rounded border-white/30"
                  />
                  Ist Kanzlei-Postfach
                </label>
              </div>
            </div>
          </div>

          {/* Section: IMAP */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground border-b border-white/10 dark:border-white/[0.06] pb-2">
              IMAP-Server
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Host
                </label>
                <input
                  type="text"
                  value={form.imapHost || ""}
                  onChange={(e) => updateField("imapHost", e.target.value)}
                  placeholder="imap.server.de"
                  className="w-full px-3 py-2 text-sm bg-transparent border border-white/20 dark:border-white/[0.08] rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand-500"
                />
                {errors.imapHost && (
                  <p className="text-xs text-red-500 mt-0.5">
                    {errors.imapHost}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={form.imapPort || 993}
                  onChange={(e) =>
                    updateField("imapPort", parseInt(e.target.value))
                  }
                  className="w-full px-3 py-2 text-sm bg-transparent border border-white/20 dark:border-white/[0.08] rounded-lg text-foreground focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Verschluesselung
                </label>
                <select
                  value={form.imapSecure ? "ssl" : "starttls"}
                  onChange={(e) =>
                    updateField("imapSecure", e.target.value === "ssl")
                  }
                  className="w-full px-3 py-2 text-sm bg-transparent border border-white/20 dark:border-white/[0.08] rounded-lg text-foreground focus:outline-none focus:border-brand-500"
                >
                  <option value="ssl">SSL/TLS</option>
                  <option value="starttls">STARTTLS</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: SMTP */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground border-b border-white/10 dark:border-white/[0.06] pb-2">
              SMTP-Server
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Host
                </label>
                <input
                  type="text"
                  value={form.smtpHost || ""}
                  onChange={(e) => updateField("smtpHost", e.target.value)}
                  placeholder="smtp.server.de"
                  className="w-full px-3 py-2 text-sm bg-transparent border border-white/20 dark:border-white/[0.08] rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand-500"
                />
                {errors.smtpHost && (
                  <p className="text-xs text-red-500 mt-0.5">
                    {errors.smtpHost}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={form.smtpPort || 587}
                  onChange={(e) =>
                    updateField("smtpPort", parseInt(e.target.value))
                  }
                  className="w-full px-3 py-2 text-sm bg-transparent border border-white/20 dark:border-white/[0.08] rounded-lg text-foreground focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Verschluesselung
                </label>
                <select
                  value={form.smtpSecure ? "ssl" : "starttls"}
                  onChange={(e) =>
                    updateField("smtpSecure", e.target.value === "ssl")
                  }
                  className="w-full px-3 py-2 text-sm bg-transparent border border-white/20 dark:border-white/[0.08] rounded-lg text-foreground focus:outline-none focus:border-brand-500"
                >
                  <option value="ssl">SSL/TLS</option>
                  <option value="starttls">STARTTLS</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Authentifizierung */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground border-b border-white/10 dark:border-white/[0.06] pb-2">
              <Shield className="w-4 h-4 inline-block mr-1.5 text-muted-foreground" />
              Authentifizierung
            </h3>

            {form.authTyp === "PASSWORT" ? (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Passwort
                </label>
                <input
                  type="password"
                  value={form.passwort || ""}
                  onChange={(e) => updateField("passwort", e.target.value)}
                  placeholder={kontoId ? "Neues Passwort (leer = unveraendert)" : "Passwort eingeben"}
                  className="w-full px-3 py-2 text-sm bg-transparent border border-white/20 dark:border-white/[0.08] rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand-500"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                <Info className="w-4 h-4" />
                OAuth2 wird in einer zukuenftigen Version unterstuetzt.
              </div>
            )}
          </div>

          {/* Section: Sync-Einstellungen */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground border-b border-white/10 dark:border-white/[0.06] pb-2">
              Synchronisation
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Initial-Sync
                </label>
                <select
                  value={form.initialSync || "DREISSIG_TAGE"}
                  onChange={(e) =>
                    updateField(
                      "initialSync",
                      e.target.value as "NUR_NEUE" | "DREISSIG_TAGE" | "ALLES"
                    )
                  }
                  className="w-full px-3 py-2 text-sm bg-transparent border border-white/20 dark:border-white/[0.08] rounded-lg text-foreground focus:outline-none focus:border-brand-500"
                >
                  <option value="NUR_NEUE">Nur neue E-Mails</option>
                  <option value="DREISSIG_TAGE">Letzte 30 Tage</option>
                  <option value="ALLES">Alles synchronisieren</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Soft-Delete Aufbewahrung
                </label>
                <select
                  value={form.softDeleteTage || 30}
                  onChange={(e) =>
                    updateField("softDeleteTage", parseInt(e.target.value))
                  }
                  className="w-full px-3 py-2 text-sm bg-transparent border border-white/20 dark:border-white/[0.08] rounded-lg text-foreground focus:outline-none focus:border-brand-500"
                >
                  <option value={30}>30 Tage</option>
                  <option value={60}>60 Tage</option>
                  <option value={90}>90 Tage</option>
                  <option value={0}>Unbegrenzt</option>
                </select>
              </div>
            </div>
          </div>

          {/* Connection test */}
          <ConnectionTest kontoId={kontoId} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? "Wird gespeichert..." : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
