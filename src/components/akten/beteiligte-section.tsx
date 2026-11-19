"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Users, Mail, Phone, MapPin, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortalInviteDialog } from "./portal-invite-dialog";
import { BeteiligteAddDialog } from "./beteiligte-add-dialog";
import { anschriftOrt, hauptAnschrift } from "@/lib/kontakte/liste";
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
    strasse?: string | null;
    plz?: string | null;
    ort: string | null;
    adressen?: Array<{ typ?: string | null; strasse?: string | null; hausnummer?: string | null; plz?: string | null; ort?: string | null; istHaupt?: boolean | null }>;
  };
}

interface BeteiligteSectionProps {
  beteiligte: BeteiligterData[];
  akteId: string;
}

const INVITE_ALLOWED_ROLES: UserRole[] = ["ANWALT", "ADMIN"];
// Mirrors PERMISSIONS[role].canEditAkte in src/lib/rbac.ts (server-only module);
// the POST route enforces it again via requireAkteAccess({ requireEdit: true }).
const EDIT_ALLOWED_ROLES: UserRole[] = ["ADMIN", "ANWALT", "SACHBEARBEITER", "SEKRETARIAT"];

export function BeteiligteSection({ beteiligte, akteId }: BeteiligteSectionProps) {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role as UserRole | undefined;
  const canInvite = userRole ? INVITE_ALLOWED_ROLES.includes(userRole) : false;
  const canEdit = userRole ? EDIT_ALLOWED_ROLES.includes(userRole) : false;
  const [addOpen, setAddOpen] = useState(false);
  const list = beteiligte ?? [];

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          Beteiligte ({list.length})
        </h3>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 gap-1 text-xs"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            Hinzufügen
          </Button>
        )}
      </div>
      {canEdit && (
        <BeteiligteAddDialog akteId={akteId} open={addOpen} onClose={() => setAddOpen(false)} />
      )}
      {list.length === 0 && (
        <p className="text-xs text-muted-foreground">Noch keine Beteiligten erfasst.</p>
      )}
      <div className="divide-y divide-border/50">
        {list.map((b) => {
          const name =
            [b.kontakt.vorname, b.kontakt.nachname].filter(Boolean).join(" ") ||
            b.kontakt.firma ||
            "Unbekannt";

          const badgeVariant = rolleBadgeVariant[b.rolle] ?? "muted";
          const ort = anschriftOrt(hauptAnschrift(b.kontakt));

          return (
            <div
              key={b.id}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">
                      {name}
                    </span>
                    <Badge variant={badgeVariant} className="text-[10px] shrink-0">
                      {rolleLabels[b.rolle] ?? b.rolle}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    {b.kontakt.email && (
                      <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground break-all">
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
                    {ort && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {ort}
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
