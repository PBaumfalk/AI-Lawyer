import { GlassPanel } from "@/components/ui/glass-panel";

export default function NachrichtenPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Nachrichten
        </h1>
        <p className="text-muted-foreground mt-1">
          Internes Messaging mit Aktenbezug
        </p>
      </div>

      <GlassPanel elevation="panel" className="p-12 text-center">
        <p className="text-muted-foreground">
          Das Nachrichtenmodul befindet sich in Entwicklung (Phase 2).
        </p>
      </GlassPanel>
    </div>
  );
}
