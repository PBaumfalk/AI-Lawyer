"use client";

import { useSession } from "next-auth/react";
import { Users, Mail, Phone, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PortalInviteDialog } from "./portal-invite-dialog";
import { rolleLabels, rolleBadgeVariant } from "./akte-detail-tabs";
import type { UserRole } from "@prisma/client";

interface BeteiligterData {
  id: string;
  rolle: string;
  kontaktId: string;
  kontakt: {
    id: string;
    typ: string;
    vorname: string | null;
    nachname: string | null;
    firma: string | null;
    email: string | null;
    telefon: string | null;
    ort: string | null;
  };
}

interface BeteiligteSectionProps {
  beteiligte: BeteiligterData[];
  akteId: string;
}

const INVITE_ALLOWED_ROLES: UserRole[] = ["ANWALT", "ADMIN"];

export function BeteiligteSection({ beteiligte, akteId }: BeteiligteSectionProps) {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role as UserRole | undefined;
  const canInvite = userRole ? INVITE_ALLOWED_ROLES.includes(userRole) : false;

  if (!beteiligte || beteiligte.length === 0) {
    return null;
  }

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          Beteiligte ({beteiligte.length})
        </h3>
      </div>
      <div className="divide-y divide-border/50">
        {beteiligte.map((b) => {
          const name =
            [b.kontakt.vorname, b.kontakt.nachname].filter(Boolean).join(" ") ||
            b.kontakt.firma ||
            "Unbekannt";

          const badgeVariant = rolleBadgeVariant[b.rolle] ?? "muted";

          return (
            <div
              key={b.id}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {name}
                    </span>
                    <Badge variant={badgeVariant} className="text-[10px] shrink-0">
                      {rolleLabels[b.rolle] ?? b.rolle}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {b.kontakt.email && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        {b.kontakt.email}
                      </span>
                    )}
                    {b.kontakt.telefon && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        {b.kontakt.telefon}
                      </span>
                    )}
                    {b.kontakt.ort && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {b.kontakt.ort}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Portal invite button — only for MANDANT rolle, only for ANWALT/ADMIN users */}
              {canInvite && b.rolle === "MANDANT" && (
                <PortalInviteDialog
                  beteiligter={b}
                  akteId={akteId}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
