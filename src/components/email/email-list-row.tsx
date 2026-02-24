"use client";

import { useCallback, memo } from "react";
import { Paperclip, AlertCircle, Archive, Trash2, MailOpen } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmailListItem {
  id: string;
  betreff: string;
  absender: string;
  absenderName: string | null;
  empfaenger: string[];
  inhaltText: string | null;
  empfangenAm: string | null;
  gesendetAm: string | null;
  gelesen: boolean;
  veraktet: boolean;
  prioritaet: string;
  richtung: string;
  anhaengeCount: number;
  veraktungen?: Array<{
    akte: { aktenzeichen: string } | null;
  }>;
  createdAt: string;
}

interface EmailListRowProps {
  email: EmailListItem;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: (emailId: string) => void;
  onToggleCheck: (emailId: string) => void;
  onShiftClick: (emailId: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const EmailListRow = memo(function EmailListRow({
  email,
  isSelected,
  isChecked,
  onSelect,
  onToggleCheck,
  onShiftClick,
}: EmailListRowProps) {
  const isUnread = !email.gelesen;
  const isHighPriority = email.prioritaet === "HOCH";
  const dateStr = email.empfangenAm ?? email.gesendetAm ?? email.createdAt;
  const formattedDate = formatEmailDate(new Date(dateStr));
  const previewSnippet = email.inhaltText
    ? email.inhaltText.substring(0, 80).replace(/\s+/g, " ")
    : "";

  // First aktenzeichen from veraktungen
  const aktenzeichen =
    email.veraktungen?.[0]?.akte?.aktenzeichen ?? null;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        onShiftClick(email.id);
      } else {
        onSelect(email.id);
      }
    },
    [email.id, onSelect, onShiftClick]
  );

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleCheck(email.id);
    },
    [email.id, onToggleCheck]
  );

  // Sender display: first initial for avatar
  const senderName = email.absenderName || email.absender;
  const initial = senderName.charAt(0).toUpperCase();

  return (
    <div
      onClick={handleClick}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800/50",
        isSelected
          ? "bg-brand-50 dark:bg-brand-950/20"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/30",
        isUnread && !isSelected && "bg-white dark:bg-slate-900"
      )}
      role="row"
      aria-selected={isSelected}
      data-email-id={email.id}
    >
      {/* Checkbox */}
      <div className="flex-shrink-0" onClick={handleCheckboxClick}>
        <input
          type="checkbox"
          checked={isChecked}
          readOnly
          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500 cursor-pointer"
        />
      </div>

      {/* Sender avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold",
          isUnread
            ? "bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300"
            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
        )}
      >
        {initial}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Sender + Subject line */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm truncate",
              isUnread
                ? "font-semibold text-foreground"
                : "font-medium text-foreground/80"
            )}
          >
            {senderName}
          </span>
          {isHighPriority && (
            <AlertCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
          )}
        </div>

        {/* Subject */}
        <p
          className={cn(
            "text-sm truncate",
            isUnread ? "text-foreground/90" : "text-muted-foreground"
          )}
        >
          {email.betreff || "(Kein Betreff)"}
        </p>

        {/* Preview snippet */}
        {previewSnippet && (
          <p className="text-xs text-muted-foreground/60 truncate mt-0.5">
            {previewSnippet}
          </p>
        )}
      </div>

      {/* Right side: badges + date */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        {/* Date */}
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          {formattedDate}
        </span>

        {/* Badges row */}
        <div className="flex items-center gap-1">
          {/* Attachment icon */}
          {email.anhaengeCount > 0 && (
            <Paperclip className="w-3 h-3 text-slate-400" />
          )}

          {/* Veraktung badge */}
          {email.veraktet && aktenzeichen && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 whitespace-nowrap">
              {aktenzeichen}
            </span>
          )}
        </div>
      </div>

      {/* Quick actions on hover */}
      <div className="flex-shrink-0 hidden group-hover:flex items-center gap-0.5">
        <QuickAction icon={MailOpen} title="Als gelesen markieren" />
        <QuickAction icon={Archive} title="Archivieren" />
        <QuickAction icon={Trash2} title="Loeschen" />
      </div>
    </div>
  );
});

// ─── Quick action button ────────────────────────────────────────────────────

function QuickAction({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <button
      onClick={(e) => e.stopPropagation()}
      title={title}
      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

// ─── Date formatting (German locale) ────────────────────────────────────────

function formatEmailDate(date: Date): string {
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const isSameYear = date.getFullYear() === now.getFullYear();
  if (isSameYear) {
    return date.toLocaleDateString("de-DE", {
      day: "numeric",
      month: "short",
    });
  }

  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
