import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PortalLoginForm } from "./portal-login-form";

export const dynamic = "force-dynamic";

// Server component: redirect already-authenticated MANDANT users to dashboard
export default async function PortalLoginPage() {
  const session = await auth();

  if (session?.user && (session.user as any).role === "MANDANT") {
    redirect("/portal/dashboard");
  }

  return <PortalLoginForm />;
}
