"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PortalError]", error);
  }, [error]);

  const truncatedMessage =
    error.message.length > 200
      ? error.message.slice(0, 200) + "..."
      : error.message;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md bg-card/60 backdrop-blur-md border border-border/40 rounded-xl p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Fehler im Portal
          </h1>
          <p className="text-sm text-muted-foreground">{truncatedMessage}</p>
          {error.digest && (
            <p className="text-xs text-muted-foreground/60">
              Fehler-ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Erneut versuchen
          </button>
          <Link
            href="/portal"
            className="inline-flex items-center justify-center rounded-lg border border-border/40 bg-card/40 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-card/60 transition-colors"
          >
            Zum Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
