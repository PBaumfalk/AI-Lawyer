import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { QADashboardContent } from "./qa-dashboard-content";

// Admin-only QA dashboard -- skip static generation
export const dynamic = "force-dynamic";

export default async function QADashboardPage() {
  const session = await auth();

  // Only ADMIN role can access QA dashboard
  if ((session?.user as any)?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">QA Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Helena Qualitaetsmetriken und Release-Gates
        </p>
      </div>

      <QADashboardContent />
    </div>
  );
}
