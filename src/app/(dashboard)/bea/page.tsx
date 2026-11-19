import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { BeaInbox } from "@/components/bea/bea-inbox";

// beA runs server-side (certificate stored per user); the page needs no beA login.
export default async function BeaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const isAnwalt = (session.user as { role?: string }).role === "ANWALT";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">beA</h1>
          <p className="text-muted-foreground mt-1">Besonderes elektronisches Anwaltspostfach</p>
        </div>
        {isAnwalt && (
          <Link
            href="/bea/compose"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Neue Nachricht
          </Link>
        )}
      </div>

      <BeaInbox />
    </div>
  );
}
