"use client";

import { useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TicketTagList } from "./ticket-tag-badge";

interface TicketTagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** If true, shows ai: tags as read-only (non-removable). Default: true */
  protectAiTags?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Tag input for tickets. Allows adding/removing user tags.
 * AI tags (ai:*) are displayed but protected from manual removal.
 * Users cannot add ai: prefixed tags — those are system-managed.
 */
export function TicketTagInput({
  tags,
  onChange,
  protectAiTags = true,
  placeholder = "Neuen Tag eingeben...",
  className,
}: TicketTagInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback(() => {
    const tag = input.trim().toLowerCase();
    if (!tag) return;

    // Prevent adding ai: tags manually
    if (tag.startsWith("ai:")) {
      setInput("");
      return;
    }

    if (!tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInput("");
    inputRef.current?.focus();
  }, [input, tags, onChange]);

  const removeTag = useCallback(
    (tag: string) => {
      // Protect ai: tags from removal
      if (protectAiTags && tag.startsWith("ai:")) return;
      onChange(tags.filter((t) => t !== tag));
    },
    [tags, onChange, protectAiTags]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
    // Remove last tag on backspace with empty input
    if (e.key === "Backspace" && !input) {
      const userTags = tags.filter((t) => !t.startsWith("ai:"));
      if (userTags.length > 0) {
        removeTag(userTags[userTags.length - 1]);
      }
    }
  }

  return (
    <div className={className}>
      {/* Display current tags */}
      <TicketTagList
        tags={tags}
        onRemove={(tag) => {
          if (protectAiTags && tag.startsWith("ai:")) return;
          removeTag(tag);
        }}
        className="mb-2"
      />

      {/* Input row */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-9 text-sm max-w-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTag}
          disabled={!input.trim() || input.trim().startsWith("ai:")}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Hinzufügen
        </Button>
      </div>

      {/* Hint about ai: tags */}
      {input.startsWith("ai:") && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
          Tags mit &quot;ai:&quot;-Präfix werden automatisch vom System vergeben.
        </p>
      )}
    </div>
  );
}
