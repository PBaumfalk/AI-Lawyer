"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DokumenteTab } from "@/components/dokumente/dokumente-tab";
import { KalenderTab } from "@/components/kalender/kalender-tab";
import { AktenkontoLedger } from "@/components/finanzen/aktenkonto-ledger";
import { InvoiceList } from "@/components/finanzen/invoice-list";
import { AkteZeiterfassungTab } from "@/components/finanzen/akte-zeiterfassung-tab";
import { ActivityFeed } from "./activity-feed";
import { FalldatenTab } from "./falldaten-tab";
import { BeteiligteSection } from "./beteiligte-section";
import { AkteChannelTab, PortalChannelTab } from "@/components/messaging/akte-channel-tab";
import { CaseSummaryPanel } from "./case-summary-panel";
import { MessageSquare, UserCircle, MoreHorizontal, Mail, ExternalLink, FileBarChart, FileText } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

// Serialized version of the Prisma akte with includes
export interface AkteData {
  id: string;
  aktenzeichen: string;
  kurzrubrum: string;
  wegen: string | null;
  sachgebiet: string;
  status: string;
  gegenstandswert: string | null;
  falldaten: Record<string, any> | null;
  falldatenTemplateId: string | null;
  notizen: string | null;
  anwalt: { id: string; name: string; email: string } | null;
  sachbearbeiter: { id: string; name: string; email: string } | null;
  kanzlei: { name: string } | null;
  angelegt: string;
  geaendert: string;
  beteiligte: Array<{
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
  }>;
  dokumente: Array<{
    id: string;
    name: string;
    mimeType: string;
    groesse: number;
    ordner: string | null;
    tags: string[];
    status: "ENTWURF" | "ZUR_PRUEFUNG" | "FREIGEGEBEN" | "VERSENDET";
    erstelltDurch: string | null;
    freigegebenDurch: { id: string; name: string } | null;
    freigegebenAm: string | null;
    createdAt: string;
    createdBy: { name: string };
  }>;
  kalenderEintraege: Array<{
    id: string;
    typ: string;
    titel: string;
    datum: string;
    erledigt: boolean;
    verantwortlich: { name: string };
  }>;
  auditLogs: Array<{
    id: string;
    aktion: string;
    details: any;
    createdAt: string;
    user: { name: string } | null;
  }>;
  _count?: {
    dokumente: number;
    kalenderEintraege: number;
    zeiterfassungen: number;
    chatNachrichten: number;
    emailMessages: number;
  };
}

export const rolleLabels: Record<string, string> = {
  MANDANT: "Mandant",
  GEGNER: "Gegner",
  GEGNERVERTRETER: "Gegnervertreter",
  GERICHT: "Gericht",
  ZEUGE: "Zeuge",
  SACHVERSTAENDIGER: "Sachverstaendiger",
  SONSTIGER: "Sonstiger",
};

export const rolleBadgeVariant: Record<string, "default" | "danger" | "warning" | "muted" | "success"> = {
  MANDANT: "success",
  GEGNER: "danger",
  GEGNERVERTRETER: "warning",
  GERICHT: "default",
  ZEUGE: "muted",
  SACHVERSTAENDIGER: "muted",
  SONSTIGER: "muted",
};

interface AkteDetailTabsProps {
  akte: AkteData;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  // Registers the guarded tab-change handler so the parent can route
  // external tab switches (KPI cards, ?tab= param) through the
  // unsaved-changes guard instead of bypassing it.
  registerTabChange?: (fn: (tab: string) => void) => void;
  // Registers a guarded generic-navigation handler so the parent can route
  // soft navigations (e.g. router.push from KPI cards) through the same
  // Falldaten unsaved-changes guard. beforeunload does not fire on App
  // Router client-side navigation, so without this the guard is bypassed.
  registerGuardedNavigation?: (fn: (action: () => void) => void) => void;
}

export function AkteDetailTabs({ akte, activeTab: externalTab, onTabChange, registerTabChange, registerGuardedNavigation }: AkteDetailTabsProps) {
  const [internalTab, setInternalTab] = useState("feed");
  const currentTab = externalTab ?? internalTab;
  const setTab = useCallback((tab: string) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  }, [onTabChange]);

  const [completeness, setCompleteness] = useState<{
    percent: number;
    filled: number;
    total: number;
  }>({ percent: 0, filled: 0, total: 0 });
  const [falldatenDirty, setFalldatenDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  // Deferred non-tab navigation (e.g. router.push) awaiting confirmation in
  // the unsaved-changes dialog.
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Sync external tab changes into internal state
  useEffect(() => {
    if (externalTab !== undefined) {
      setInternalTab(externalTab);
    }
  }, [externalTab]);

  // ─── Controlled Tab Switching with Unsaved Changes Guard ─────────────────

  const handleTabChange = useCallback(
    (newTab: string) => {
      // If leaving Falldaten tab with unsaved changes, show warning
      if (currentTab === "falldaten" && falldatenDirty && newTab !== "falldaten") {
        setPendingTab(newTab);
        setShowUnsavedDialog(true);
        return;
      }
      setTab(newTab);
    },
    [currentTab, falldatenDirty, setTab]
  );

  // Expose the guarded handler so external navigation (KPI cards) goes
  // through the same unsaved-changes guard as tab triggers / overflow menu.
  useEffect(() => {
    registerTabChange?.(handleTabChange);
  }, [registerTabChange, handleTabChange]);

  // Guarded generic navigation for soft navigations that bypass both the
  // tab guard and beforeunload (App Router client-side routing, e.g.
  // router.push from the E-Mails KPI card). Runs the action immediately
  // unless Falldaten is dirty, in which case the action is deferred until
  // the user confirms in the unsaved-changes dialog.
  const requestGuardedNavigation = useCallback(
    (action: () => void) => {
      if (currentTab === "falldaten" && falldatenDirty) {
        setPendingAction(() => action);
        setShowUnsavedDialog(true);
        return;
      }
      action();
    },
    [currentTab, falldatenDirty]
  );

  useEffect(() => {
    registerGuardedNavigation?.(requestGuardedNavigation);
  }, [registerGuardedNavigation, requestGuardedNavigation]);

  // ─── Browser beforeunload Guard ──────────────────────────────────────────

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (falldatenDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [falldatenDirty]);

  // Overflow menu for secondary tabs (Falldaten, KI-Analyse, Chat, Portal)
  const overflowTabs = [
    { value: "falldaten", label: "Falldaten", icon: FileText },
    { value: "zusammenfassung", label: "KI-Analyse", icon: FileBarChart },
    { value: "nachrichten", label: "Chat", icon: MessageSquare },
    { value: "portal-nachrichten", label: "Portal", icon: UserCircle },
  ];
  const overflowActive = overflowTabs.some((t) => t.value === currentTab);

  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  // Close overflow on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    if (overflowOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [overflowOpen]);

  return (
    <>
      <Tabs defaultValue="feed" value={currentTab} onValueChange={handleTabChange}>
        <div className="flex items-center gap-1">
          <TabsList className="flex-1 justify-start">
            <TabsTrigger value="feed">Aktivitaeten</TabsTrigger>
            <TabsTrigger value="dokumente">
              Dokumente ({akte.dokumente.length})
            </TabsTrigger>
            <TabsTrigger value="kalender">
              Termine & Fristen ({akte.kalenderEintraege.length})
            </TabsTrigger>
            <TabsTrigger value="finanzen">Finanzen</TabsTrigger>
          </TabsList>

          {/* Overflow menu for secondary tabs */}
          <div ref={overflowRef} className="relative">
            <button
              type="button"
              onClick={() => setOverflowOpen((v) => !v)}
              aria-label="Weitere Tabs"
              className={`flex items-center justify-center h-9 w-9 rounded-md border text-sm font-medium transition-colors
                ${overflowActive
                  ? "bg-background text-foreground border-border shadow-sm"
                  : "bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
                }`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {overflowOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-md border border-border bg-popover shadow-md p-1">
                {overflowTabs.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      handleTabChange(value);
                      setOverflowOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm transition-colors
                      ${currentTab === value
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent hover:text-accent-foreground text-foreground"
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* --- Feed (default) ------------------------------------------------ */}
        <TabsContent value="feed">
          <div className="space-y-6">
            <BeteiligteSection beteiligte={akte.beteiligte} akteId={akte.id} />
            <ActivityFeed akteId={akte.id} />
          </div>
        </TabsContent>

        {/* --- Dokumente ----------------------------------------------------- */}
        <TabsContent value="dokumente">
          <DokumenteTab akteId={akte.id} initialDokumente={akte.dokumente} />
        </TabsContent>

        {/* --- Kalender ------------------------------------------------------ */}
        <TabsContent value="kalender">
          <KalenderTab
            akteId={akte.id}
            initialEintraege={akte.kalenderEintraege}
          />
        </TabsContent>

        {/* --- Finanzen (combined Aktenkonto + Rechnungen + Zeiterfassung) ---- */}
        <TabsContent value="finanzen">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Aktenkonto
              </h3>
              <AktenkontoLedger
                akteId={akte.id}
                aktenzeichen={akte.aktenzeichen}
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Rechnungen
              </h3>
              <InvoiceList akteId={akte.id} />
            </div>
            <div id="zeiterfassung-section">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Zeiterfassung
              </h3>
              <AkteZeiterfassungTab akteId={akte.id} />
            </div>
          </div>
        </TabsContent>

        {/* --- Falldaten ---------------------------------------------------- */}
        <TabsContent value="falldaten">
          <FalldatenTab
            akteId={akte.id}
            sachgebiet={akte.sachgebiet}
            initialFalldaten={akte.falldaten}
            falldatenTemplateId={akte.falldatenTemplateId}
            onCompletenessChange={setCompleteness}
            onDirtyChange={setFalldatenDirty}
          />
        </TabsContent>

        {/* --- Zusammenfassung (KI-Analyse) -------------------------------- */}
        <TabsContent value="zusammenfassung">
          <CaseSummaryPanel akteId={akte.id} />
        </TabsContent>

        {/* --- Nachrichten (Akte channel) ---------------------------------- */}
        <TabsContent value="nachrichten">
          <AkteChannelTab akteId={akte.id} />
        </TabsContent>

        {/* --- Portal-Nachrichten (PORTAL channels for this Akte) --------- */}
        <TabsContent value="portal-nachrichten">
          <PortalChannelTab akteId={akte.id} />
        </TabsContent>
      </Tabs>

      {/* --- Unsaved Changes Dialog ----------------------------------------- */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ungespeicherte Aenderungen</AlertDialogTitle>
            <AlertDialogDescription>
              Sie haben ungespeicherte Aenderungen in den Falldaten. Moechten
              Sie trotzdem fortfahren? Ihre Aenderungen gehen verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingTab(null);
                setPendingAction(null);
                setShowUnsavedDialog(false);
              }}
            >
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingTab) setTab(pendingTab);
                else pendingAction?.();
                setPendingTab(null);
                setPendingAction(null);
                setShowUnsavedDialog(false);
                setFalldatenDirty(false);
              }}
            >
              Trotzdem fortfahren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
