import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";

// Admin pages require fresh data — skip static generation during build
export const dynamic = "force-dynamic";

const adminNavigation = [
  { name: "Job-Monitor", href: "/admin/jobs" },
  { name: "System", href: "/admin/system" },
  { name: "Pipeline", href: "/admin/pipeline" },
  { name: "Dezernate", href: "/admin/dezernate" },
  { name: "Rollen", href: "/admin/rollen" },
  { name: "Audit-Trail", href: "/admin/audit-trail" },
  { name: "DSGVO", href: "/admin/dsgvo" },
  { name: "Einstellungen", href: "/admin/settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Only ADMIN role can access admin pages
  if ((session?.user as any)?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      {/* Admin sub-navigation */}
      <div className="border-b border-border/50">
        <nav className="flex gap-6" aria-label="Administration">
          {adminNavigation.map((item) => (
            <AdminNavLink key={item.href} href={item.href}>
              {item.name}
            </AdminNavLink>
          ))}
        </nav>
      </div>

      {/* Admin page content */}
      <div className="max-w-7xl">{children}</div>
    </div>
  );
}

// Client-side nav link with active state highlighting
// Extracted to separate file pattern won't work here since this is
// a server component layout. We use a simple approach instead.
function AdminNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="px-1 pb-3 text-sm font-medium text-muted-foreground hover:text-foreground border-b-2 border-transparent hover:border-brand-600 transition-colors"
    >
      {children}
    </Link>
  );
}
