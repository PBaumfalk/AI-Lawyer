"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, FileSignature, RefreshCw, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MailboxList } from "@/components/email/mailbox-config/mailbox-list";
import { SignatureEditor } from "@/components/email/mailbox-config/signature-editor";
import { SyncDashboard } from "@/components/email/mailbox-config/sync-dashboard";
import { UserAssignment } from "@/components/email/mailbox-config/user-assignment";
import { GlassPanel } from "@/components/ui/glass-panel";

export default function EmailEinstellungenPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [kanzleiKontoId, setKanzleiKontoId] = useState<string | undefined>();

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        setSession(data);
        if (data?.user?.role !== "ADMIN") {
          router.push("/einstellungen");
        }
      })
      .catch(() => router.push("/einstellungen"))
      .finally(() => setLoading(false));
  }, [router]);

  // Load the Kanzlei mailbox ID for signature editor
  useEffect(() => {
    fetch("/api/email-konten")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        const kanzleiKonto = list.find((k: any) => k.istKanzlei);
        if (kanzleiKonto) {
          setKanzleiKontoId(kanzleiKonto.id);
        } else if (list.length > 0) {
          // Fall back to first mailbox if no kanzlei mailbox
          setKanzleiKontoId(list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Lade E-Mail-Einstellungen...</div>
      </div>
    );
  }

  if (session?.user?.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          E-Mail-Einstellungen
        </h1>
        <p className="text-muted-foreground mt-1">
          Postfaecher, Signaturen, Synchronisation und Benutzerzuweisungen verwalten
        </p>
      </div>

      <Tabs defaultValue="postfaecher">
        <TabsList>
          <TabsTrigger value="postfaecher">
            <Mail className="w-4 h-4 mr-1.5" />
            Postfaecher
          </TabsTrigger>
          <TabsTrigger value="signatur">
            <FileSignature className="w-4 h-4 mr-1.5" />
            Signatur
          </TabsTrigger>
          <TabsTrigger value="sync-status">
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Sync-Status
          </TabsTrigger>
          <TabsTrigger value="zuweisung">
            <Users className="w-4 h-4 mr-1.5" />
            Zuweisung
          </TabsTrigger>
        </TabsList>

        <TabsContent value="postfaecher">
          <GlassPanel elevation="panel" className="p-6">
            <MailboxList />
          </GlassPanel>
        </TabsContent>

        <TabsContent value="signatur">
          <GlassPanel elevation="panel" className="p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">
              Kanzlei-Signatur
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Definieren Sie eine kanzleiweite HTML-Signatur-Vorlage. Platzhalter werden
              automatisch durch die Benutzerdaten jedes Mitarbeiters ersetzt.
            </p>
            <SignatureEditor kontoId={kanzleiKontoId} />
          </GlassPanel>
        </TabsContent>

        <TabsContent value="sync-status">
          <GlassPanel elevation="panel" className="p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">
              Sync-Status
            </h2>
            <SyncDashboard />
          </GlassPanel>
        </TabsContent>

        <TabsContent value="zuweisung">
          <GlassPanel elevation="panel" className="p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">
              Benutzer-Zuweisung
            </h2>
            <UserAssignment />
          </GlassPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
