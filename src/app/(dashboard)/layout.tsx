import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SessionProvider } from "@/components/providers/session-provider";
import { SocketProvider } from "@/components/socket-provider";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandFristenRechnerWrapper } from "@/components/layout/command-fristenrechner-wrapper";

// All dashboard pages require auth + fresh data — skip static generation during build
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Provider hierarchy: SessionProvider > SocketProvider > NotificationProvider
  return (
    <SessionProvider>
      <SocketProvider>
        <NotificationProvider>
          <div className="flex h-screen overflow-hidden bg-mesh">
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto p-6">
                {children}
              </main>
            </div>
            <CommandFristenRechnerWrapper />
          </div>
        </NotificationProvider>
      </SocketProvider>
    </SessionProvider>
  );
}
