import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/rbac";
import type { UserRole } from "@prisma/client";

// Firm-wide tag categories are firm configuration (canAccessEinstellungen).
export default async function DokumentTagsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as any)?.role as UserRole | undefined;
  if (!role || !PERMISSIONS[role]?.canAccessEinstellungen) redirect("/einstellungen");
  return <>{children}</>;
}
