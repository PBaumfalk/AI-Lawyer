import { Bell } from "lucide-react";
import { AlertCenter } from "@/components/helena/alert-center";

export default function AlertsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            <h1 className="text-2xl font-semibold text-foreground">
              Warnungen
            </h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Automatisch erkannte Probleme und kritische Hinweise
          </p>
        </div>
      </div>

      <AlertCenter />
    </div>
  );
}
