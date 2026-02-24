"use client";

import { useEffect, useCallback, useRef } from "react";
import type { EmailStore } from "@/hooks/use-email-store";

/**
 * Gmail-style keyboard shortcut hook for email navigation and actions.
 *
 * Shortcuts:
 *   J - Next email
 *   K - Previous email
 *   R - Reply
 *   A - Reply All
 *   F - Forward
 *   V - Verakten
 *   E - Archive
 *   # or Delete - Delete
 *   Enter - Open selected email
 *   Escape - Deselect / close
 *
 * Only active when focus is not in an input/textarea/contenteditable element.
 */
export function useKeyboardShortcuts(emailStore: EmailStore): void {
  // Track current email list for J/K navigation
  const emailListRef = useRef<string[]>([]);

  // Update email list from DOM (used for J/K navigation)
  const updateEmailList = useCallback(() => {
    const rows = document.querySelectorAll("[role='row'][aria-selected]");
    const ids: string[] = [];
    rows.forEach((row) => {
      const id = row.getAttribute("data-email-id");
      if (id) ids.push(id);
    });
    emailListRef.current = ids;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      // Ignore if modifier keys are pressed (except shift for some)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();

      switch (key) {
        case "j": {
          // Next email
          e.preventDefault();
          navigateEmail(emailStore, "next");
          break;
        }
        case "k": {
          // Previous email
          e.preventDefault();
          navigateEmail(emailStore, "prev");
          break;
        }
        case "r": {
          // Reply - dispatch custom event that EmailDetail will listen to
          if (!e.shiftKey) {
            e.preventDefault();
            dispatchReplyEvent("reply");
          }
          break;
        }
        case "a": {
          // Reply All
          e.preventDefault();
          dispatchReplyEvent("replyAll");
          break;
        }
        case "f": {
          // Forward
          e.preventDefault();
          dispatchReplyEvent("forward");
          break;
        }
        case "v": {
          // Verakten
          e.preventDefault();
          // Will be connected in Plan 04
          break;
        }
        case "e": {
          // Archive
          e.preventDefault();
          if (emailStore.selectedEmailId) {
            dispatchEmailAction("archive");
          }
          break;
        }
        case "#":
        case "delete": {
          // Delete
          e.preventDefault();
          if (emailStore.selectedEmailId) {
            dispatchEmailAction("delete");
          }
          break;
        }
        case "enter": {
          // Open selected email (already handled by click)
          break;
        }
        case "escape": {
          // Deselect / close
          e.preventDefault();
          emailStore.selectEmail(null);
          emailStore.clearChecked();
          break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [emailStore, updateEmailList]);
}

// ─── Navigation ─────────────────────────────────────────────────────────────

function navigateEmail(
  emailStore: EmailStore,
  direction: "next" | "prev"
): void {
  // Find all email rows in the DOM to get the email ID list
  const rows = document.querySelectorAll("[role='row']");
  const emailIds: string[] = [];
  rows.forEach((row) => {
    const selected = row.getAttribute("aria-selected");
    if (selected !== null) {
      // Extract email ID from the row's data or find the enclosing element
      const emailId = findEmailIdFromRow(row);
      if (emailId) emailIds.push(emailId);
    }
  });

  if (emailIds.length === 0) return;

  const currentIndex = emailStore.selectedEmailId
    ? emailIds.indexOf(emailStore.selectedEmailId)
    : -1;

  let nextIndex: number;
  if (direction === "next") {
    nextIndex = currentIndex < emailIds.length - 1 ? currentIndex + 1 : currentIndex;
  } else {
    nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
  }

  if (nextIndex >= 0 && nextIndex < emailIds.length) {
    emailStore.selectEmail(emailIds[nextIndex]);
  }
}

function findEmailIdFromRow(row: Element): string | null {
  // The email list row dispatches select via onClick which sets the ID.
  // We need a way to get the email ID from the DOM row.
  // We'll use a data attribute approach - the email list will set data-email-id
  const id = row.getAttribute("data-email-id");
  return id;
}

// ─── Event dispatchers ──────────────────────────────────────────────────────

function dispatchReplyEvent(mode: "reply" | "replyAll" | "forward"): void {
  window.dispatchEvent(
    new CustomEvent("email:reply-action", { detail: { mode } })
  );
}

function dispatchEmailAction(action: "archive" | "delete"): void {
  window.dispatchEvent(
    new CustomEvent("email:action", { detail: { action } })
  );
}
