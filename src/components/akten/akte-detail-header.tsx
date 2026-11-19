"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil } from "lucide-react";
import { AkteEditDialog } from "./akte-edit-dialog";
import { AkteStatusMenu } from "./akte-status-menu";

interface AkteHeaderData {
  id: string;
  aktenzeichen: string;
  kurzrubrum: string;
  wegen: string | null;
  sachgebiet: string;
  status: string;
  gegenstandswert: string | null;
  notizen: string | null;
  anwalt: { id: string; name: string; email: string } | null;
  sachbearbeiter: { id: string; name: string; email: string } | null;
}

const sachgebietLabels: Record<string, string> = {
  ARBEITSRECHT: "Arbeitsrecht",
  FAMILIENRECHT: "Familienrecht",
  VERKEHRSRECHT: "Verkehrsrecht",
  MIETRECHT: "Mietrecht",
  STRAFRECHT: "Strafrecht",
  ERBRECHT: "Erbrecht",
  SOZIALRECHT: "Sozialrecht",
  INKASSO: "Inkasso",
  HANDELSRECHT: "Handelsrecht",
  VERWALTUNGSRECHT: "Verwaltungsrecht",
  SONSTIGES: "Sonstiges",
};

const statusBadge: Record<string, "success" | "warning" | "muted" | "danger"> =
  {
    OFFEN: "success",
    RUHEND: "warning",
    ARCHIVIERT: "muted",
    GESCHLOSSEN: "danger",
  };

export function AkteDetailHeader({ akte }: { akte: AkteHeaderData }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2 sm:gap-4">
          <Link href="/akten" aria-label="Zurück zur Aktenliste">
            <Button variant="ghost" size="icon" className="mt-1" tabIndex={-1}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="min-w-0 break-words text-2xl font-semibold text-foreground">
                {akte.kurzrubrum}
              </h1>
              <Badge variant={statusBadge[akte.status] ?? "muted"}>
                {akte.status}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{akte.aktenzeichen}</span>
              <span>
                {sachgebietLabels[akte.sachgebiet] ?? akte.sachgebiet}
              </span>
              {akte.wegen && <span>wegen {akte.wegen}</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="w-4 h-4 mr-1" />
            Bearbeiten
          </Button>
          <AkteStatusMenu akteId={akte.id} currentStatus={akte.status} />
        </div>
      </div>

      <AkteEditDialog
        akte={akte}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </>
  );
}
