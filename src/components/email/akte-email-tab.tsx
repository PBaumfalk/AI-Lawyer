"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Mail,
  MailOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Paperclip,
  ExternalLink,
  Loader2,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AkteEmailItem {
  id: string;
  richtung: string;
  betreff: string;
  absender: string;
  absenderName: string | null;
  empfaenger: string[];
  gelesen: boolean;
  veraktet: boolean;
  empfangenAm: string | null;
  gesendetAm: string | null;
  preview: string;
  anhaengeCount: number;
  veraktung: { akteId: string; aktenzeichen: string } | null;
}

interface AkteEmailTabProps {
  akteId: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AkteEmailTab({ akteId }: AkteEmailTabProps) {
  const [emails, setEmails] = useState<AkteEmailItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/emails?akteId=${akteId}&veraktet=true&limit=50`
      );
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [akteId]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  // Remove Veraktung for this Akte
  const handleRemoveVeraktung = useCallback(
    async (emailId: string) => {
      try {
        // First find the veraktung for this email + akte
        const detailRes = await fetch(
          `/api/emails/${emailId}/veraktung`
        );
        if (!detailRes.ok) return;
        const detailData = await detailRes.json();
        const veraktung = (detailData.veraktungen ?? []).find(
          (v: any) => v.akteId === akteId && !v.aufgehoben
        );
        if (!veraktung) return;

        const res = await fetch(`/api/emails/${emailId}/veraktung`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ veraktungId: veraktung.id }),
        });

        if (res.ok) {
          toast.success("Veraktung aufgehoben");
          // Remove from local list
          setEmails((prev) => prev.filter((e) => e.id !== emailId));
        }
      } catch {
        toast.error("Fehler beim Aufheben der Veraktung");
      }
    },
    [akteId]
  );

  if (loading) {
    return (
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-12 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {emails.length} veraktete E-Mail
          {emails.length !== 1 ? "s" : ""} in dieser Akte
        </p>
        <Link href={`/email?akteId=${akteId}`}>
          <Button variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-1.5" />
            Im E-Mail-Client oeffnen
          </Button>
        </Link>
      </div>

      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] overflow-hidden">
        {emails.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">
              Keine E-Mails mit dieser Akte verknuepft.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              E-Mails koennen ueber die E-Mail-Detailansicht veraktet werden.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/10 dark:divide-white/[0.04]">
            {emails.map((email) => {
              const isUnread = !email.gelesen;
              const isIncoming = email.richtung === "EINGEHEND";
              const dateStr =
                email.empfangenAm ?? email.gesendetAm;
              const date = dateStr ? new Date(dateStr) : null;

              return (
                <div
                  key={email.id}
                  className={`group flex items-center gap-4 px-6 py-3.5 hover:bg-white/20 dark:hover:bg-white/[0.05] transition-colors ${
                    isUnread ? "bg-brand-50/50 dark:bg-brand-950/20" : ""
                  }`}
                >
                  {/* Email link -- clicking opens in email client */}
                  <Link
                    href={`/email?emailId=${email.id}`}
                    className="flex items-center gap-4 flex-1 min-w-0"
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      {isUnread ? (
                        <Mail className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                      ) : (
                        <MailOpen className="w-4 h-4 text-slate-400" />
                      )}
                    </div>

                    {/* Direction */}
                    <div className="flex-shrink-0">
                      {isIncoming ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 text-blue-500" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm truncate ${
                            isUnread
                              ? "font-semibold text-foreground"
                              : "font-medium text-foreground/80"
                          }`}
                        >
                          {isIncoming
                            ? email.absenderName || email.absender
                            : `An: ${email.empfaenger[0] ?? ""}`}
                        </span>
                        {email.anhaengeCount > 0 && (
                          <Paperclip className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        )}
                      </div>
                      <p
                        className={`text-xs truncate ${
                          isUnread
                            ? "text-foreground/80"
                            : "text-muted-foreground"
                        }`}
                      >
                        {email.betreff || "(Kein Betreff)"}
                      </p>
                      {email.preview && (
                        <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">
                          {email.preview}
                        </p>
                      )}
                    </div>

                    {/* Date */}
                    <div className="flex-shrink-0 text-xs text-muted-foreground">
                      {date?.toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })}
                    </div>
                  </Link>

                  {/* Remove veraktung action (hover) */}
                  <button
                    onClick={() => handleRemoveVeraktung(email.id)}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 transition-all"
                    title="Veraktung aufheben"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
