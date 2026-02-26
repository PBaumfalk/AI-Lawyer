"use client";

import { X, Maximize2, Minimize2 } from "lucide-react";
import { useState } from "react";
import { OnlyOfficeEditor } from "./onlyoffice-editor";

interface EditorDialogProps {
  dokument: {
    id: string;
    name: string;
    mimeType: string;
  };
  mode?: "edit" | "view";
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

/**
 * Full-screen dialog for editing documents in ONLYOFFICE.
 */
export function EditorDialog({
  dokument,
  mode = "edit",
  open,
  onClose,
  onSaved,
}: EditorDialogProps) {
  const [fullscreen, setFullscreen] = useState(true);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Dialog */}
      <div
        className={`relative bg-white/50 dark:bg-white/[0.05] backdrop-blur-md flex flex-col transition-all duration-200 ${
          fullscreen
            ? "w-full h-full"
            : "w-[95vw] h-[90vh] rounded-xl shadow-2xl border border-white/20 dark:border-white/[0.08]"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/20 dark:border-white/[0.08] bg-white/15 dark:bg-white/[0.04] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h2 className="text-sm font-medium text-foreground truncate">
                {dokument.name}
              </h2>
              <p className="text-[10px] text-slate-500">
                {mode === "edit" ? "Bearbeitung" : "Ansicht"} ·{" "}
                {dokument.mimeType.split("/").pop()?.toUpperCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setFullscreen(!fullscreen)}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              title={fullscreen ? "Verkleinern" : "Vollbild"}
            >
              {fullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              title="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          <OnlyOfficeEditor
            dokumentId={dokument.id}
            mode={mode}
            onClose={onClose}
            onSaved={onSaved}
          />
        </div>
      </div>
    </div>
  );
}
