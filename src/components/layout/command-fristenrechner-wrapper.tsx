"use client";

import { useState, useCallback } from "react";
import { CommandPalette } from "./command-palette";
import {
  FristenRechnerSheet,
  useFristenRechnerShortcut,
} from "@/components/fristen/fristenrechner-sheet";

/**
 * Client wrapper that integrates the Command Palette with the FristenRechner sheet.
 * Handles keyboard shortcuts and command palette -> FristenRechner bridge.
 */
export function CommandFristenRechnerWrapper() {
  const [fristenRechnerOpen, setFristenRechnerOpen] = useState(false);

  const openFristenRechner = useCallback(() => {
    setFristenRechnerOpen(true);
  }, []);

  // Register Cmd+Shift+F shortcut
  useFristenRechnerShortcut(openFristenRechner);

  return (
    <>
      <CommandPalette onFristenRechner={openFristenRechner} />
      <FristenRechnerSheet
        open={fristenRechnerOpen}
        onOpenChange={setFristenRechnerOpen}
      />
    </>
  );
}
