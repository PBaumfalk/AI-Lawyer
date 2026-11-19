"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { FristenRechnerForm } from "./fristenrechner-form";
import { FristenRechnerErgebnis } from "./fristenrechner-ergebnis";
import { Calculator, Loader2 } from "lucide-react";
import { istFristenrechnerKuerzel } from "@/lib/fristen/tastenkuerzel";
import {
  fristVorlageAusRechnerErgebnis,
  type FristVorlage,
} from "@/lib/fristen/als-frist";

interface FristenRechnerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the Kalender dialog pre-filled with the calculated Frist */
  onAlsFristSpeichern?: (vorlage: FristVorlage) => void;
}

/**
 * FristenRechner sidebar Sheet (~600px) containing the form and result display.
 *
 * Triggered by:
 * - Keyboard shortcut (Cmd+Shift+F)
 * - Command Palette entry (Cmd+K -> "Frist berechnen")
 */
export function FristenRechnerSheet({
  open,
  onOpenChange,
  onAlsFristSpeichern,
}: FristenRechnerSheetProps) {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Reset result when sheet closes
  useEffect(() => {
    if (!open) {
      // Don't immediately clear result -- let animation finish
      const timer = setTimeout(() => {
        setResult(null);
        setLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleResult = useCallback((r: any) => {
    setResult(r);
  }, []);

  const handleLoading = useCallback((l: boolean) => {
    setLoading(l);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[600px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-brand-600" />
            Fristenrechner
          </SheetTitle>
          <SheetDescription>
            Berechnen Sie Fristen nach BGB Sections 187-193 mit
            Feiertagsberücksichtigung.
          </SheetDescription>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* Form */}
          <FristenRechnerForm
            onResult={handleResult}
            onLoading={handleLoading}
          />

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            <div className="border-t border-white/20 dark:border-white/[0.08] pt-6">
              <FristenRechnerErgebnis
                result={result}
                onAlsFristSpeichern={
                  onAlsFristSpeichern
                    ? () => {
                        const vorlage = fristVorlageAusRechnerErgebnis(result);
                        if (vorlage) onAlsFristSpeichern(vorlage);
                      }
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Hook to register the FristenRechner keyboard shortcut.
 * Call this in a layout or provider component.
 */
export function useFristenRechnerShortcut(
  onOpen: () => void
): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+Shift+F (Mac) or Ctrl+Shift+F (Windows/Linux)
      if (istFristenrechnerKuerzel(e)) {
        e.preventDefault();
        onOpen();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen]);
}
