export default function NachrichtenPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading text-foreground">
          Nachrichten
        </h1>
        <p className="text-muted-foreground mt-1">
          Internes Messaging mit Aktenbezug
        </p>
      </div>

      <div className="glass rounded-xl p-12 text-center">
        <p className="text-muted-foreground">
          Das Nachrichtenmodul befindet sich in Entwicklung (Phase 2).
        </p>
      </div>
    </div>
  );
}
