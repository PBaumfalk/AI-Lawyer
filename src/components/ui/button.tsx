"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Persimmon (CI-Contract §6): Primär = Orange mit Graphit-Schrift,
// Sekundär/Outline = deckende Fläche mit Kontur, Ghost = neutral,
// Destruktiv = Rot mit Weiß. Fokus kommt aus der globalen Regel in
// globals.css (3-px-Ring, 3 px Abstand). Höhe 44 px, kompakt 36 px.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 aria-busy:cursor-progress",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-95",
        outline:
          "border border-border bg-[var(--al-surface)] text-foreground hover:border-primary-strong hover:bg-primary-soft",
        secondary: "bg-secondary text-secondary-foreground hover:bg-primary-soft",
        ghost: "text-foreground hover:bg-primary-soft",
        link: "text-primary-strong underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3 text-[13px]",
        lg: "h-12 px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Asynchrone Aktion läuft: sperrt Mehrfachauslösung, zeigt Fortschritt. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {children}
        {loading && <span className="sr-only">Wird verarbeitet</span>}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
