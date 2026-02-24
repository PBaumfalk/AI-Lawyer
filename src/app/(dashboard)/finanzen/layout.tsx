"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Calculator, Receipt, BookOpen } from "lucide-react";

const finanzenTabs = [
  { name: "Uebersicht", href: "/finanzen", icon: LayoutDashboard },
  { name: "Rechner", href: "/finanzen/rechner", icon: Calculator },
  { name: "Rechnungen", href: "/finanzen/rechnungen", icon: Receipt },
  { name: "Aktenkonto", href: "/finanzen/aktenkonto", icon: BookOpen },
];

export default function FinanzenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs */}
      <nav className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {finanzenTabs.map((tab) => {
          const isActive =
            tab.href === "/finanzen"
              ? pathname === "/finanzen"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.name}
            </Link>
          );
        })}
      </nav>

      {/* Page content */}
      {children}
    </div>
  );
}
