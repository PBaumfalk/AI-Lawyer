import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { KalenderListe } from "@/components/kalender/kalender-liste";

export default async function KalenderPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <KalenderListe />;
}
