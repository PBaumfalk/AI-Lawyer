"use client";

import { useEffect, useRef } from "react";

interface MentionMember {
  userId: string;
  userName: string;
}

interface MentionPickerProps {
  members: MentionMember[];
  query: string;
  isOpen: boolean;
  onSelect: (member: MentionMember) => void;
  selectedIndex: number;
}

/**
 * Get initials from a name (max 2 chars).
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name[0] ?? "?").toUpperCase();
}

/**
 * Generate a deterministic color from a name for avatar background.
 */
function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `oklch(65% 0.15 ${hue})`;
}

export function MentionPicker({
  members,
  query,
  isOpen,
  onSelect,
  selectedIndex,
}: MentionPickerProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Build filtered list: @alle + @Helena + matching members
  const allOptions: MentionMember[] = [];

  // Add @alle at the top
  allOptions.push({ userId: "__alle__", userName: "alle" });

  // Add @Helena if not already in members
  const hasHelena = members.some(
    (m) => m.userName.toLowerCase() === "helena"
  );
  if (!hasHelena) {
    allOptions.push({ userId: "__helena__", userName: "Helena" });
  }

  // Add members
  allOptions.push(...members);

  // Filter by query
  const filtered = query
    ? allOptions.filter((m) =>
        m.userName.toLowerCase().startsWith(query.toLowerCase())
      )
    : allOptions;

  // Clamp selected index
  const clampedIndex = Math.min(
    Math.max(0, selectedIndex),
    Math.max(0, filtered.length - 1)
  );

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.children;
    const item = items[clampedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [clampedIndex]);

  // Handle Enter key selection from parent -- listen for Enter keydown on document
  useEffect(() => {
    if (!isOpen || filtered.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && isOpen) {
        const selected = filtered[clampedIndex];
        if (selected) {
          onSelect(selected);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", handleKeyDown, {
        capture: true,
      });
  }, [isOpen, filtered, clampedIndex, onSelect]);

  if (!isOpen || filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 w-64 mb-2 glass-panel-elevated rounded-xl shadow-xl max-h-48 overflow-y-auto z-50"
    >
      {filtered.map((member, idx) => (
        <button
          key={member.userId}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent textarea blur
            onSelect(member);
          }}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
            idx === clampedIndex
              ? "bg-violet-500/20 text-foreground"
              : "text-muted-foreground hover:bg-white/5 dark:hover:bg-white/[0.03]"
          }`}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
            style={{ backgroundColor: nameToColor(member.userName) }}
          >
            {getInitials(member.userName)}
          </div>
          <span className="truncate">
            {member.userId === "__alle__" ? "@alle (alle Mitglieder)" : member.userName}
          </span>
        </button>
      ))}
    </div>
  );
}
