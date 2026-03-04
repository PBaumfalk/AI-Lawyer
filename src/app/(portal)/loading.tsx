import { Loader2 } from "lucide-react";

export default function PortalLoading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <span className="ml-3 text-muted-foreground">Laden...</span>
    </div>
  );
}
