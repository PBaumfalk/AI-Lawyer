"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X } from "lucide-react";

interface Recipient {
  email: string;
  name?: string;
}

interface ComposeRecipientsProps {
  label: string;
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
}

interface Suggestion {
  email: string;
  name?: string;
  source: "kontakt" | "email";
}

export function ComposeRecipients({
  label,
  value,
  onChange,
  placeholder,
}: ComposeRecipientsProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced search for auto-complete
  const searchRecipients = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      // Query contacts and previous email addresses in parallel
      const [kontakteRes, emailsRes] = await Promise.all([
        fetch(
          `/api/kontakte?search=${encodeURIComponent(query)}&limit=5`
        ).catch(() => null),
        fetch(
          `/api/emails?search=${encodeURIComponent(query)}&limit=10&fields=absender,absenderName`
        ).catch(() => null),
      ]);

      const results: Suggestion[] = [];

      // Parse contacts
      if (kontakteRes?.ok) {
        const kontakte = await kontakteRes.json();
        const items = Array.isArray(kontakte) ? kontakte : kontakte?.data ?? [];
        for (const k of items) {
          if (k.email) {
            results.push({
              email: k.email,
              name: k.name || k.vorname
                ? `${k.vorname || ""} ${k.nachname || k.name || ""}`.trim()
                : undefined,
              source: "kontakt",
            });
          }
        }
      }

      // Parse previous email addresses
      if (emailsRes?.ok) {
        const emailData = await emailsRes.json();
        const items = Array.isArray(emailData)
          ? emailData
          : emailData?.data ?? [];
        const seen = new Set(results.map((r) => r.email.toLowerCase()));

        for (const e of items) {
          const addr = e.absender;
          if (addr && !seen.has(addr.toLowerCase())) {
            seen.add(addr.toLowerCase());
            results.push({
              email: addr,
              name: e.absenderName || undefined,
              source: "email",
            });
          }
        }
      }

      // Filter by query
      const filtered = results.filter(
        (r) =>
          r.email.toLowerCase().includes(query.toLowerCase()) ||
          r.name?.toLowerCase().includes(query.toLowerCase())
      );

      setSuggestions(filtered.slice(0, 8));
      setShowSuggestions(filtered.length > 0);
      setSelectedIndex(0);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  const handleInputChange = (val: string) => {
    setInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchRecipients(val), 300);
  };

  const addRecipient = (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return;
    // Basic email validation
    if (trimmed.includes("@") && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeRecipient = (email: string) => {
    onChange(value.filter((e) => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
      e.preventDefault();
      if (showSuggestions && suggestions[selectedIndex]) {
        addRecipient(suggestions[selectedIndex].email);
      } else if (input.trim()) {
        addRecipient(input);
      }
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeRecipient(value[value.length - 1]);
    } else if (e.key === "ArrowDown" && showSuggestions) {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp" && showSuggestions) {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // Close suggestions on outside click
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex items-start border-b border-white/10 dark:border-white/[0.06]">
      <label className="px-4 py-2.5 text-sm text-muted-foreground w-14 flex-shrink-0">
        {label}:
      </label>
      <div className="flex-1 relative">
        <div className="flex items-center flex-wrap gap-1 px-2 py-1.5 min-h-[38px]">
          {/* Recipient chips */}
          {value.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs rounded-full"
            >
              <span className="max-w-[200px] truncate">{email}</span>
              <button
                type="button"
                onClick={() => removeRecipient(email)}
                className="hover:text-brand-900 dark:hover:text-brand-100 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              // Delay to allow click on suggestion
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            placeholder={value.length === 0 ? (placeholder || "E-Mail-Adresse eingeben...") : ""}
            className="flex-1 min-w-[150px] bg-transparent border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none py-1"
          />
        </div>

        {/* Auto-complete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-white/20 dark:border-white/[0.08] max-h-48 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={s.email}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addRecipient(s.email);
                }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                  i === selectedIndex
                    ? "bg-brand-50 dark:bg-brand-900/20"
                    : "hover:bg-white/50 dark:hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex-1 min-w-0">
                  {s.name && (
                    <div className="font-medium text-foreground truncate">
                      {s.name}
                    </div>
                  )}
                  <div className="text-muted-foreground truncate">
                    {s.email}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                  {s.source === "kontakt" ? "Kontakt" : "E-Mail"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
