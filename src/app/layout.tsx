import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";

export const metadata: Metadata = {
  title: "AI-Lawyer | Kanzleisoftware",
  description: "AI-First Kanzleisoftware – Akten, Dokumente, Fristen, KI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
          <Toaster
            position="bottom-right"
            richColors
            toastOptions={{
              classNames: {
                toast: "glass-panel !border-[var(--glass-border-color)] !shadow-[var(--glass-shadow-lg)]",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
