import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { User } from "lucide-react";
import { PasswordChangeForm } from "./password-change-form";

export const dynamic = "force-dynamic";

export default async function PortalProfilPage() {
  const session = await auth();

  if (!session?.user || (session.user as any).role !== "MANDANT") {
    redirect("/portal/login");
  }

  // Load user with linked Kontakt
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      kontaktId: true,
    },
  });

  let kontaktData: {
    vorname: string | null;
    nachname: string | null;
    email: string | null;
    telefon: string | null;
    mobil: string | null;
    strasse: string | null;
    plz: string | null;
    ort: string | null;
    land: string | null;
  } | null = null;

  if (user?.kontaktId) {
    const kontakt = await prisma.kontakt.findUnique({
      where: { id: user.kontaktId },
      select: {
        vorname: true,
        nachname: true,
        email: true,
        telefon: true,
        mobil: true,
        strasse: true,
        plz: true,
        ort: true,
        land: true,
        adressen: {
          where: { typ: "HAUPTANSCHRIFT" },
          take: 1,
          select: {
            strasse: true,
            hausnummer: true,
            plz: true,
            ort: true,
            land: true,
          },
        },
      },
    });

    if (kontakt) {
      // Use Adresse record if available, fall back to legacy Kontakt address fields
      const hauptAdresse = kontakt.adressen[0];
      kontaktData = {
        vorname: kontakt.vorname,
        nachname: kontakt.nachname,
        email: kontakt.email,
        telefon: kontakt.telefon,
        mobil: kontakt.mobil,
        strasse: hauptAdresse
          ? [hauptAdresse.strasse, hauptAdresse.hausnummer]
              .filter(Boolean)
              .join(" ") || null
          : kontakt.strasse,
        plz: hauptAdresse?.plz ?? kontakt.plz,
        ort: hauptAdresse?.ort ?? kontakt.ort,
        land: hauptAdresse?.land ?? kontakt.land,
      };
    }
  }

  const displayName = kontaktData
    ? [kontaktData.vorname, kontaktData.nachname].filter(Boolean).join(" ")
    : session.user.name ?? "-";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <User className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-heading text-foreground">Mein Profil</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card 1: Kontaktinformationen (read-only) */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-heading text-foreground mb-4">
            Ihre Kontaktdaten
          </h2>

          <div className="space-y-3">
            <InfoRow label="Name" value={displayName} />
            <InfoRow label="E-Mail" value={kontaktData?.email} />
            <InfoRow label="Telefon" value={kontaktData?.telefon} />
            <InfoRow label="Mobil" value={kontaktData?.mobil} />
            <InfoRow
              label="Adresse"
              value={
                kontaktData?.strasse
                  ? [
                      kontaktData.strasse,
                      [kontaktData.plz, kontaktData.ort]
                        .filter(Boolean)
                        .join(" "),
                      kontaktData.land,
                    ]
                      .filter(Boolean)
                      .join(", ")
                  : null
              }
            />
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            Kontaktdaten werden von Ihrer Kanzlei verwaltet. Bei Aenderungen
            wenden Sie sich bitte an Ihren Anwalt.
          </p>
        </div>

        {/* Card 2: Password change (interactive) */}
        <PasswordChangeForm />
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1">
      <span className="text-sm text-muted-foreground min-w-[100px]">
        {label}
      </span>
      <span className="text-sm text-foreground">{value ?? "-"}</span>
    </div>
  );
}
