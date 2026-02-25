import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BeaCompose } from "@/components/bea/bea-compose";

export default async function BeaComposePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userRole = (session.user as any).role;

  // RBAC: Only ANWALT can access compose
  if (userRole !== "ANWALT") {
    redirect("/bea?error=keine-berechtigung");
  }

  return <BeaCompose />;
}
