"use client";

import { Mail, Globe, Server } from "lucide-react";

export interface ProviderProfile {
  id: string;
  name: string;
  icon: "microsoft" | "google" | "ionos" | "strato" | "manual";
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

const PROVIDERS: ProviderProfile[] = [
  {
    id: "microsoft365",
    name: "Microsoft 365",
    icon: "microsoft",
    imapHost: "imap.outlook.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.outlook.com",
    smtpPort: 587,
    smtpSecure: false, // STARTTLS
  },
  {
    id: "gmail",
    name: "Gmail",
    icon: "google",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpSecure: false, // STARTTLS
  },
  {
    id: "ionos",
    name: "IONOS",
    icon: "ionos",
    imapHost: "imap.ionos.de",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.ionos.de",
    smtpPort: 587,
    smtpSecure: false, // STARTTLS
  },
  {
    id: "strato",
    name: "Strato",
    icon: "strato",
    imapHost: "imap.strato.de",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.strato.de",
    smtpPort: 465,
    smtpSecure: true, // SSL
  },
  {
    id: "manual",
    name: "Manuell",
    icon: "manual",
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
  },
];

function ProviderIcon({ icon }: { icon: ProviderProfile["icon"] }) {
  switch (icon) {
    case "microsoft":
      return (
        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
      );
    case "google":
      return (
        <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <Mail className="w-4 h-4 text-red-600 dark:text-red-400" />
        </div>
      );
    case "ionos":
    case "strato":
      return (
        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <Server className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </div>
      );
  }
}

interface ProviderProfilesProps {
  selectedId?: string;
  onSelect: (profile: ProviderProfile) => void;
}

export function ProviderProfiles({
  selectedId,
  onSelect,
}: ProviderProfilesProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        E-Mail-Anbieter
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => onSelect(provider)}
            className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border transition-colors ${
              selectedId === provider.id
                ? "border-brand-500 bg-brand-50/50 dark:bg-brand-900/10"
                : "border-white/20 dark:border-white/[0.08] hover:border-white/40 dark:hover:border-white/[0.15] hover:bg-white/20 dark:hover:bg-white/[0.04]"
            }`}
          >
            <ProviderIcon icon={provider.icon} />
            <span className="text-xs font-medium text-foreground">
              {provider.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
