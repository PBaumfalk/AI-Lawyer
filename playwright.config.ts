// Browsertests (Playwright) für Anmeldung, Benutzerverwaltung und Passwortwechsel.
//
// Laufen gegen einen gestarteten Produktionsserver mit Testdatenbank, nie gegen
// echte Kanzleidaten. Ablauf und Voraussetzungen: tests/e2e/README.md.
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3999";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // Tests teilen sich Server, Datenbank und Anmeldezähler.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL,
    // Lokal installiertes Google Chrome statt heruntergeladenem Chromium
    channel: process.env.E2E_BROWSER_CHANNEL ?? "chrome",
    locale: "de-DE",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    {
      name: "mobil",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
  ],
});
