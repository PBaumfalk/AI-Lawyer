import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Layout for /ki-chat — Helena AI chat.
 * Server component with auth check. Renders children in a full-height container.
 */
export default async function KiChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden -m-6">
      {children}
    </div>
  );
}
