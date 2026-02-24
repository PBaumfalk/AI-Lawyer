"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  ChevronRight,
  Users,
  Download,
  Settings,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VertretungUrlaubTab } from "@/components/einstellungen/vertretung-urlaub-tab";
import { ImportExportTab } from "@/components/einstellungen/import-export-tab";
import { OnboardingWizard } from "@/components/einstellungen/onboarding-wizard";

export default function EinstellungenPage() {
  const [session, setSession] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load session info
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        setSession(data);
        // Check if onboarding should show (admin only, not yet completed)
        if (data?.user?.role === "ADMIN") {
          checkOnboarding();
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const checkOnboarding = async () => {
    try {
      // Check if onboarding_completed setting exists
      const res = await fetch("/api/einstellungen/export");
      if (!res.ok) return;
      const data = await res.json();
      const onboardingSetting = data.systemSettings?.find(
        (s: any) => s.key === "onboarding_completed"
      );
      if (!onboardingSetting || onboardingSetting.value !== "true") {
        setShowOnboarding(true);
      }
    } catch {
      // If we can't check, don't show wizard (non-blocking)
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Lade Einstellungen...</div>
      </div>
    );
  }

  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <>
      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading text-foreground">
            Einstellungen
          </h1>
          <p className="text-muted-foreground mt-1">
            Kanzlei- und Benutzereinstellungen
          </p>
        </div>

        <Tabs defaultValue="allgemein">
          <TabsList>
            <TabsTrigger value="allgemein">
              <Settings className="w-4 h-4 mr-1.5" />
              Allgemein
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="vertretung">
                <Users className="w-4 h-4 mr-1.5" />
                Vertretung & Urlaub
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="import-export">
                <Download className="w-4 h-4 mr-1.5" />
                Import/Export
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="allgemein">
            <div className="space-y-6">
              {/* User info */}
              <div className="glass rounded-xl p-6">
                <h2 className="text-lg font-heading text-foreground mb-4">
                  Benutzer
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-white/10 dark:border-white/[0.06]">
                    <span className="text-muted-foreground">Name</span>
                    <span className="text-foreground font-medium">
                      {session?.user?.name}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/10 dark:border-white/[0.06]">
                    <span className="text-muted-foreground">E-Mail</span>
                    <span className="text-foreground font-medium">
                      {session?.user?.email}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Rolle</span>
                    <span className="text-foreground font-medium">
                      {session?.user?.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick links */}
              <div className="glass rounded-xl p-6">
                <h2 className="text-lg font-heading text-foreground mb-4">
                  Verwaltung
                </h2>
                <div className="space-y-1">
                  <Link
                    href="/einstellungen/vorlagen"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/30 dark:hover:bg-white/[0.05] transition-colors group"
                  >
                    <FileText className="w-5 h-5 text-muted-foreground group-hover:text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        Dokumentvorlagen
                      </p>
                      <p className="text-xs text-muted-foreground">
                        DOCX-Vorlagen mit Platzhaltern verwalten
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
                  </Link>
                </div>
              </div>
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="vertretung">
              <VertretungUrlaubTab />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="import-export">
              <ImportExportTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </>
  );
}
