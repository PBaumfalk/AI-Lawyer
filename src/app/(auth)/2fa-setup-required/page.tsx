import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "2FA-Einrichtung erforderlich",
};

export default function TwoFASetupRequired() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-mesh">
      <div className="w-full max-w-md mx-4">
        <div className="glass-lg rounded-2xl p-8 text-center">
          <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-heading text-foreground mb-2">
            Zwei-Faktor-Authentifizierung erforderlich
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Ihre Rolle erfordert eine aktive Zwei-Faktor-Authentifizierung.
            Bitte richten Sie 2FA in Ihren Einstellungen ein, um fortzufahren.
          </p>
          <Button asChild className="w-full">
            <Link href="/einstellungen?tab=sicherheit">
              Zu den Sicherheitseinstellungen
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
