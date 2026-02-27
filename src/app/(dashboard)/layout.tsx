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

  // Resolve OnlyOffice URL for preloading the editor SDK script
  const headersList = await headers();
  const onlyofficeUrl = resolvePublicOnlyOfficeUrl(headersList);
  const ooApiScript = `${onlyofficeUrl}/web-apps/apps/api/documents/api.js`;

  // Provider hierarchy: SessionProvider > SocketProvider > NotificationProvider > UploadProvider
  return (
    <SessionProvider>
      <SocketProvider>
        <NotificationProvider>
          <UploadProvider>
            {/* OnlyOffice preload: hidden iframe caches HTML/CSS/JS/fonts (v9.0+)
                See: https://api.onlyoffice.com/docs/docs-api/get-started/configuration/preload/ */}
            <link rel="dns-prefetch" href={onlyofficeUrl} />
            <link rel="preconnect" href={onlyofficeUrl} crossOrigin="anonymous" />
            <iframe
              src={`${onlyofficeUrl}/web-apps/apps/api/documents/preload.html`}
              style={{ display: "none" }}
              aria-hidden="true"
              tabIndex={-1}
            />
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
