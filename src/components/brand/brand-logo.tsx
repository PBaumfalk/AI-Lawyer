// AI-Lawyer-Logo (Persimmon). SVG-Master aus public/brand/logos – nicht
// nachzeichnen, nicht verzerren, keine Schatten (CI-Contract §3).
// Wortmarke mindestens 132 px breit, Signet mindestens 20 px hoch.
import { cn } from "@/lib/utils";

const WORTMARKE = { breite: 440, hoehe: 88 };
const SIGNET = { breite: 96, hoehe: 80 };

export function BrandWordmark({ width = 160, className }: { width?: number; className?: string }) {
  const w = Math.max(width, 132);
  const h = Math.round((w * WORTMARKE.hoehe) / WORTMARKE.breite);
  return (
    <span className={cn("inline-flex", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- statisches SVG, keine Optimierung nötig */}
      <img src="/brand/logos/wordmark-primary.svg" alt="AI-Lawyer" width={w} height={h} className="block dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logos/wordmark-white.svg" alt="AI-Lawyer" width={w} height={h} className="hidden dark:block" />
    </span>
  );
}

export function BrandMark({ height = 24, className, label = "AI-Lawyer" }: { height?: number; className?: string; label?: string }) {
  const h = Math.max(height, 20);
  const w = Math.round((h * SIGNET.breite) / SIGNET.hoehe);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/logos/mark-primary.svg" alt={label} width={w} height={h} className={cn("block", className)} />
  );
}
