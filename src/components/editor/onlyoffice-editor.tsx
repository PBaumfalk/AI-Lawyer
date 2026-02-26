"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Dynamically import the official OnlyOffice React component (no SSR)
const DocumentEditor = dynamic(
  () =>
    import("@onlyoffice/document-editor-react").then(
      (mod) => mod.DocumentEditor
    ),
  { ssr: false }
);

interface OnlyOfficeEditorProps {
  dokumentId: string;
  mode?: "edit" | "view";
  onClose?: () => void;
  onSaved?: () => void;
}

interface EditorState {
  status: "loading" | "ready" | "error";
  error?: string;
  config?: Record<string, unknown>;
  onlyofficeUrl?: string;
}

/**
 * OnlyOffice editor component using the official @onlyoffice/document-editor-react package.
 * This handles script loading, DOM management, and React lifecycle correctly.
 */
export function OnlyOfficeEditor({
  dokumentId,
  mode = "edit",
  onClose,
  onSaved,
}: OnlyOfficeEditorProps) {
  const [state, setState] = useState<EditorState>({ status: "loading" });

  // Stable refs for callbacks to avoid re-renders
  const onCloseRef = useRef(onClose);
  const onSavedRef = useRef(onSaved);
  onCloseRef.current = onClose;
  onSavedRef.current = onSaved;

  // Fetch config on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchConfig() {
      try {
        const res = await fetch(
          `/api/onlyoffice/config/${dokumentId}?mode=${mode}`
        );
        if (cancelled) return;

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error ??
              `Fehler beim Laden der Editor-Konfiguration (${res.status})`
          );
        }

        const { config, onlyofficeUrl } = await res.json();
        if (cancelled) return;

        // Remove any events from server config — events are set via component props.
        // The official component uses Object.assign which would overwrite prop events.
        const { events: _discard, ...cleanConfig } = config;

        setState({ status: "loading", config: cleanConfig, onlyofficeUrl });
      } catch (err: any) {
        if (!cancelled) {
          setState({ status: "error", error: err.message });
        }
      }
    }

    fetchConfig();
    return () => {
      cancelled = true;
    };
  }, [dokumentId, mode]);

  const onDocumentReady = useCallback(() => {
    console.log("[ONLYOFFICE] Document ready");
    setState((prev) => ({ ...prev, status: "ready" }));
  }, []);

  const onAppReady = useCallback(() => {
    console.log("[ONLYOFFICE] App ready");
  }, []);

  const onError = useCallback((event: any) => {
    console.error("[ONLYOFFICE] Editor error:", event);
    const data = event?.data;
    setState((prev) => ({
      ...prev,
      status: "error",
      error: `OnlyOffice Fehler: ${data?.errorDescription ?? data?.errorCode ?? "Unbekannt"}`,
    }));
  }, []);

  const onDocumentStateChange = useCallback((event: any) => {
    // data=false means document was saved
    if (!event?.data) {
      onSavedRef.current?.();
    }
  }, []);

  const onLoadComponentError = useCallback(
    (errorCode: number, errorDescription: string) => {
      console.error(
        "[ONLYOFFICE] Component load error:",
        errorCode,
        errorDescription
      );
      setState((prev) => ({
        ...prev,
        status: "error",
        error: `Editor konnte nicht geladen werden (Code ${errorCode}): ${errorDescription}`,
      }));
    },
    []
  );

  // Show error state
  if (state.status === "error") {
    return (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 p-8 bg-white/50 dark:bg-white/[0.05] backdrop-blur-md">
        <AlertCircle className="w-12 h-12 text-rose-400" />
        <div className="text-center max-w-md">
          <p className="text-sm font-medium text-foreground">
            Editor konnte nicht geladen werden
          </p>
          <p className="text-xs text-slate-500 mt-1">{state.error}</p>
          {state.onlyofficeUrl && (
            <p className="text-xs text-slate-400 mt-2">
              ONLYOFFICE URL: {state.onlyofficeUrl}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Seite neu laden
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Schließen
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Loading overlay — shown until document is ready */}
      {state.status === "loading" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-white/[0.05] backdrop-blur-md">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Editor wird geladen...</p>
          </div>
        </div>
      )}

      {/* Render the official OnlyOffice DocumentEditor once config is loaded */}
      {state.config && state.onlyofficeUrl && (
        <DocumentEditor
          id="onlyoffice-editor"
          documentServerUrl={state.onlyofficeUrl}
          config={state.config as any}
          events_onDocumentReady={onDocumentReady}
          events_onAppReady={onAppReady}
          events_onError={onError}
          events_onDocumentStateChange={onDocumentStateChange}
          onLoadComponentError={onLoadComponentError}
          height="100%"
          width="100%"
        />
      )}
    </div>
  );
}
