import { FileCheck } from "lucide-react";
import { DraftInbox } from "@/components/helena/draft-inbox";

export default function EntwuerfePage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            <h1 className="text-2xl font-semibold text-foreground">
              Entwuerfe
            </h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Helena-Entwuerfe zur Pruefung und Freigabe
          </p>
        </div>
      </div>

      <DraftInbox />
    </div>
  );
}
