// Persimmon-Icons als React-Komponenten.
//
// <Icon name="cases" />            – mono, currentColor, aria-hidden
// <Icon name="helena" tone="duotone" label="Helena" />
//
// Neben den 82 Paket-Icons (persimmon-shapes.tsx) stehen die Erweiterungs-
// icons aus persimmon-erweiterung.tsx zur Verfügung.
//
// Größe kommt aus className (z. B. "w-4 h-4") oder `size`. Für die
// lucide-kompatiblen Komponenten siehe ./lucide-compat.tsx.
import * as React from "react";
import { iconNames, shapes, type IconName as PaketName } from "./persimmon-shapes";
import { erweiterungsNamen, erweiterungsFormen, type ErweiterungsName } from "./persimmon-erweiterung";

export { iconNames, erweiterungsNamen, type PaketName, type ErweiterungsName };

/** Paket-Icons (82) und Erweiterungsicons im Persimmon-Stil. */
export type IconName = PaketName | ErweiterungsName;
const formen: Record<IconName, React.ReactNode> = { ...shapes, ...erweiterungsFormen };

export interface PersimmonIconProps extends Omit<React.SVGProps<SVGSVGElement>, "ref"> {
  name: IconName;
  size?: number | string;
  /** Bedeutungstragende Icons brauchen ein Label, dekorative nicht. */
  label?: string;
  tone?: "mono" | "duotone";
  /** Für abgeleitete Formen (z. B. Pfeil nach oben aus Pfeil nach unten). */
  rotate?: number;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
}

export const Icon = React.forwardRef<SVGSVGElement, PersimmonIconProps>(function Icon(
  { name, size = 24, label, tone = "mono", rotate, className, strokeWidth = 1.75, absoluteStrokeWidth: _a, children, ...rest },
  ref
) {
  const form = formen[name];
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      data-icon={name}
      data-tone={tone}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label || rest["aria-label"] ? undefined : true}
      className={["al-icon", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {rotate ? <g transform={`rotate(${rotate} 12 12)`}>{form}</g> : form}
      {children}
    </svg>
  );
});
