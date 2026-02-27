import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { resolvePublicOnlyOfficeUrl } from "@/lib/onlyoffice";
import { SessionProvider } from "@/components/providers/session-provider";
import { SocketProvider } from "@/components/socket-provider";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { UploadProvider } from "@/components/providers/upload-provider";
import { UploadPanel } from "@/components/dokumente/upload-panel";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandFristenRechnerWrapper } from "@/components/layout/command-fristenrechner-wrapper";
import { OnlyOfficePreloader } from "@/components/onlyoffice-preloader";

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

  // Resolve OnlyOffice URL from request headers (works for LAN/localhost)
  const headersList = await headers();
  const onlyofficeUrl = resolvePublicOnlyOfficeUrl(headersList);

  // Provider hierarchy: SessionProvider > SocketProvider > NotificationProvider > UploadProvider
  return (
    <SessionProvider>
      <SocketProvider>
        <NotificationProvider>
          <UploadProvider>
            {/* OnlyOffice preload: client-side prefetch avoids hydration errors + warnings */}
            <OnlyOfficePreloader url={onlyofficeUrl} />
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto p-6 bg-transparent">
                  {children}
                </main>
              </div>
              <CommandFristenRechnerWrapper />
              <UploadPanel />
            </div>
          </UploadProvider>
        </NotificationProvider>
      </SocketProvider>
    </SessionProvider>
  );
}
