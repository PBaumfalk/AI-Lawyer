"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RvgCalculator } from "@/components/finanzen/rvg-calculator";

function RechnerContent() {
  const searchParams = useSearchParams();
  const akteId = searchParams.get("akteId") ?? undefined;
  const aktenzeichen = searchParams.get("aktenzeichen") ?? undefined;
  const streitwertParam = searchParams.get("streitwert");
  const initialStreitwert = streitwertParam
    ? parseFloat(streitwertParam)
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          RVG-Rechner
        </h1>
        <p className="text-muted-foreground mt-1">
          Gebuehrenberechnung nach dem Rechtsanwaltsverguetungsgesetz
        </p>
      </div>

      <RvgCalculator
        initialStreitwert={initialStreitwert}
        akteId={akteId}
        aktenzeichen={aktenzeichen}
      />
    </div>
  );
}

export default function RechnerPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              RVG-Rechner
            </h1>
            <p className="text-muted-foreground mt-1">Laden...</p>
          </div>
        </div>
      }
    >
      <RechnerContent />
    </Suspense>
  );
}
