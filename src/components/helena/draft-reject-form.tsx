"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RejectFormData {
  categories: string[];
  text: string;
  noRevise: boolean;
}

interface DraftRejectFormProps {
  draftId: string;
  onReject: (draftId: string, data: RejectFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REJECTION_CATEGORIES = [
  "Inhaltlich falsch",
  "Unvollstaendig",
  "Ton/Stil unpassend",
  "Formatierung",
] as const;

// ---------------------------------------------------------------------------
// Checkbox component (simple, no radix dependency)
// ---------------------------------------------------------------------------

function Checkbox({
  id,
  checked,
  onChange,
  label,
  className,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-center gap-2.5 cursor-pointer select-none",
        className
      )}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border text-violet-600 focus:ring-violet-500"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Rejection form with content-focused categories, free text, and "Nicht ueberarbeiten" option.
 * Used inside DraftDetailModal.
 */
export function DraftRejectForm({
  draftId,
  onReject,
  onCancel,
  isSubmitting = false,
}: DraftRejectFormProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [noRevise, setNoRevise] = useState(false);

  const toggleCategory = useCallback((category: string) => {
    setCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  }, []);

  const handleSubmit = useCallback(() => {
    onReject(draftId, { categories, text, noRevise });
  }, [draftId, categories, text, noRevise, onReject]);

  return (
    <div className="space-y-4">
      {/* Category checkboxes */}
      <div>
        <p className="text-sm font-medium mb-2">Ablehnungsgrund</p>
        <div className="space-y-2">
          {REJECTION_CATEGORIES.map((category) => (
            <Checkbox
              key={category}
              id={`reject-${category}`}
              checked={categories.includes(category)}
              onChange={() => toggleCategory(category)}
              label={category}
            />
          ))}
        </div>
      </div>

      {/* Free text */}
      <div>
        <label htmlFor="reject-text" className="text-sm font-medium block mb-1">
          Anmerkungen (optional)
        </label>
        <textarea
          id="reject-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Weitere Hinweise fuer Helena..."
          className={cn(
            "w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "resize-y"
          )}
        />
      </div>

      {/* "Nicht ueberarbeiten" checkbox */}
      <div className="border-t border-border pt-3">
        <Checkbox
          id="reject-no-revise"
          checked={noRevise}
          onChange={setNoRevise}
          label="Nicht ueberarbeiten"
          className="text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground mt-1 ml-6">
          Helena erstellt keine neue Revision dieses Entwurfs
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Wird abgelehnt..." : "Ablehnen"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
