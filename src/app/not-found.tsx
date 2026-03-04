import { FileQuestion } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md bg-card/60 backdrop-blur-md border border-border/40 rounded-xl p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted/50 p-3">
            <FileQuestion className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            404 &mdash; Seite nicht gefunden
          </h1>
          <p className="text-sm text-muted-foreground">
            Die angeforderte Seite existiert nicht.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Zum Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-border/40 bg-card/40 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-card/60 transition-colors"
          >
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
