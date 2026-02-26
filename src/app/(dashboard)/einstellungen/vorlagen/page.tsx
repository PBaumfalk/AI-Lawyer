import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VorlagenVerwaltung } from "@/components/vorlagen/vorlagen-verwaltung";

export default async function VorlagenPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const vorlagen = await prisma.dokumentVorlage.findMany({
    orderBy: [{ kategorie: "asc" }, { name: "asc" }],
    include: {
      createdBy: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading text-foreground">
          Dokumentvorlagen
        </h1>
        <p className="text-muted-foreground mt-1">
          DOCX-Vorlagen mit Platzhaltern für die automatische Dokumentenerstellung
        </p>
      </div>

      <VorlagenVerwaltung initialVorlagen={vorlagen as any} />
    </div>
  );
}
