"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";

interface TagKategorie {
  id: string;
  name: string;
  farbe: string;
  system: boolean;
}

interface TagManagerProps {
  dokumentId: string;
  currentTags: string[];
  onTagsChange: (tags: string[]) => void;
}

/**
 * Tag management component for documents.
 * Displays current tags as colored chips with remove action.
 * Provides a combobox to add existing tags or create new ones.
 */
export function TagManager({
  dokumentId,
  currentTags,
  onTagsChange,
}: TagManagerProps) {
  const [tags, setTags] = useState<string[]>(currentTags);
  const [kategorien, setKategorien] = useState<TagKategorie[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with external changes
  useEffect(() => {
    setTags(currentTags);
  }, [currentTags]);

  // Fetch tag categories on mount
  useEffect(() => {
    fetch("/api/dokumente/tags")
      .then((res) => res.json())
      .then((data) => setKategorien(data.tags ?? []))
      .catch(() => {});
  }, []);

  // Map tag name to category for color
  const getTagColor = useCallback(
    (tagName: string): string => {
      const kat = kategorien.find((k) => k.name === tagName);
      return kat?.farbe ?? "#64748b"; // Default slate
    },
    [kategorien]
  );

  // Save tags to server
  const saveTags = useCallback(
    async (newTags: string[]) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/dokumente/${dokumentId}/tags`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: newTags }),
        });
        if (!res.ok) throw new Error("Fehler");
        setTags(newTags);
        onTagsChange(newTags);
      } catch {
        toast.error("Tags konnten nicht gespeichert werden");
        // Revert
        setTags(currentTags);
      } finally {
        setSaving(false);
      }
    },
    [dokumentId, currentTags, onTagsChange]
  );

  // Remove a tag
  const removeTag = useCallback(
    (tagToRemove: string) => {
      const newTags = tags.filter((t) => t !== tagToRemove);
      saveTags(newTags);
    },
    [tags, saveTags]
  );

  // Add a tag
  const addTag = useCallback(
    (tagName: string) => {
      const trimmed = tagName.trim();
      if (!trimmed) return;
      if (tags.includes(trimmed)) {
        toast.info(`Tag "${trimmed}" ist bereits zugewiesen`);
        return;
      }
      const newTags = [...tags, trimmed];
      saveTags(newTags);
      setInputValue("");
    },
    [tags, saveTags]
  );

  // Handle input key events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === "Escape") {
      setShowAdd(false);
      setInputValue("");
    }
  };

  // Filter available categories (not already assigned)
  const availableKategorien = kategorien.filter(
    (k) => !tags.includes(k.name)
  );
  const filteredKategorien = inputValue
    ? availableKategorien.filter((k) =>
        k.name.toLowerCase().includes(inputValue.toLowerCase())
      )
    : availableKategorien;

  // Check if the input matches an existing tag exactly
  const isNewTag =
    inputValue.trim() &&
    !kategorien.some(
      (k) => k.name.toLowerCase() === inputValue.trim().toLowerCase()
    );

  return (
    <div className="space-y-2">
      {/* Current tags */}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const color = getTagColor(tag);
          return (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[11px] gap-1 pr-1 group"
              style={{
                backgroundColor: `${color}20`,
                color: color,
                borderColor: `${color}40`,
              }}
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                disabled={saving}
                className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                title={`"${tag}" entfernen`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </Badge>
          );
        })}

        {tags.length === 0 && !showAdd && (
          <span className="text-xs text-slate-400 italic">Keine Tags</span>
        )}
      </div>

      {/* Add tag */}
      {showAdd ? (
        <div className="relative">
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tag hinzufuegen..."
              className="h-7 text-xs flex-1"
              autoFocus
              disabled={saving}
            />
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAdd(false);
                setInputValue("");
              }}
              className="h-7 px-1.5"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Dropdown with suggestions */}
          {(filteredKategorien.length > 0 || isNewTag) && inputValue && (
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 py-1 max-h-40 overflow-y-auto">
              {filteredKategorien.map((kat) => (
                <button
                  key={kat.id}
                  onClick={() => addTag(kat.name)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-left"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: kat.farbe }}
                  />
                  {kat.name}
                </button>
              ))}
              {isNewTag && (
                <button
                  onClick={() => addTag(inputValue)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-left text-blue-600 dark:text-blue-400"
                >
                  <Plus className="w-3 h-3" />
                  &quot;{inputValue.trim()}&quot; erstellen
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowAdd(true)}
          className="h-7 px-2 text-xs text-slate-500 hover:text-blue-600"
        >
          <Tag className="w-3 h-3 mr-1" />
          Tag hinzufuegen
        </Button>
      )}
    </div>
  );
}
