"use client";

import { useState, useCallback } from "react";
import { CommandPalette } from "./command-palette";
import {
  FristenRechnerSheet,
  useFristenRechnerShortcut,
} from "@/components/fristen/fristenrechner-sheet";
import { KalenderEintragDialog } from "@/components/kalender/kalender-eintrag-dialog";
import type { FristVorlage } from "@/lib/fristen/als-frist";

/**
 * Client wrapper that integrates the Command Palette with the FristenRechner sheet.
 * Handles keyboard shortcuts and command palette -> FristenRechner bridge.
 */
export function CommandFristenRechnerWrapper() {
  const [fristenRechnerOpen, setFristenRechnerOpen] = useState(false);
  const [fristVorlage, setFristVorlage] = useState<FristVorlage | null>(null);

  // "Als Frist speichern": close the sheet, open the Kalender dialog pre-filled
  const handleAlsFristSpeichern = useCallback((vorlage: FristVorlage) => {
    setFristenRechnerOpen(false);
    setFristVorlage(vorlage);
  }, []);

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
        onAlsFristSpeichern={handleAlsFristSpeichern}
      />
      <KalenderEintragDialog
        open={fristVorlage !== null}
        vorlage={fristVorlage}
        onClose={() => setFristVorlage(null)}
        onSaved={() => {
          // Let open calendar views reload
          window.dispatchEvent(new CustomEvent("kalender:geaendert"));
        }}
      />
    </>
  );
}
