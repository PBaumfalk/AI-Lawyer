import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";

export const metadata: Metadata = {
  title: "AI-Lawyer | Kanzleisoftware",
  description: "AI-First Kanzleisoftware – Akten, Dokumente, Fristen, KI",
  applicationName: "AI-Lawyer",
  // Persimmon brand assets (public/brand, copied from the design package)
  icons: {
    icon: [
      { url: "/brand/app/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/app/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/brand/app/app-icon-180.png", sizes: "180x180" }],
  },
  manifest: "/brand/app/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F6F2" },
    { media: "(prefers-color-scheme: dark)", color: "#191715" },
  ],
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
