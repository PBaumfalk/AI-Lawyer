import { Button } from "@/components/ui/button";
import { Upload, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function DokumentePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading text-foreground">
            Dokumente
          </h1>
          <p className="text-muted-foreground mt-1">
            Kanzleiweite Dokumentensuche
          </p>
        </div>
        <Button>
          <Upload className="w-4 h-4 mr-2" />
          Hochladen
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Dokumente durchsuchen..." className="pl-10" />
      </div>

      <div className="glass rounded-xl p-12 text-center">
        <p className="text-muted-foreground">
          Dokumentenverwaltung wird pro Akte bereitgestellt.
          <br />
          Nutzen Sie die kanzleiweite Suche oder öffnen Sie eine Akte.
        </p>
      </div>
    </div>
  );
}
