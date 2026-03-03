import { ArrowRight } from "lucide-react";

interface NaechsteSchritteCardProps {
  naechsteSchritte: string | null;
}

export function NaechsteSchritteCard({
  naechsteSchritte,
}: NaechsteSchritteCardProps) {
  return (
    <div className="glass-card rounded-xl p-5 border-2 border-primary/20 bg-primary/[0.03]">
      {/* Card header with accent styling */}
      <div className="flex items-center gap-2 mb-3">
        <ArrowRight className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wide">
          Naechste Schritte
        </h2>
      </div>

      {/* Content area */}
      {naechsteSchritte ? (
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
          {naechsteSchritte}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          Ihr Anwalt hat noch keine naechsten Schritte hinterlegt.
        </p>
      )}
    </div>
  );
}
