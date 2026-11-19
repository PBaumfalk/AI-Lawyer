// Automatische Barrierefreiheitsprüfung (WCAG 2.1 A/AA) mit axe-core.
//
// Prüft die Anmeldeseite und die Hauptseiten nach Anmeldung als Admin, in
// beiden Projekten (desktop, mobil). Verstöße mit Impact "serious" oder
// "critical" lassen den Test fehlschlagen; "moderate" und "minor" werden nur
// protokolliert.
//
// Eine automatische Prüfung findet nur einen Teil der Probleme. Bedienung
// mit Screenreader und Tastatur bleibt Handarbeit (docs/design/README.md).
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Result } from "axe-core";
import { ADMIN_EMAIL, ADMIN_PASSWORT, anmelden } from "./hilfen";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOCKIEREND = new Set(["serious", "critical"]);

const SEITEN = [
  "/dashboard",
  "/akten",
  "AKTE", // erste Akte, per Klick aus der Liste geöffnet
  "/kontakte",
  "/kalender",
  "/dokumente",
  "/entwuerfe",
  "/alerts",
  "/email",
  "/tickets",
  "/ki-chat",
  "/ki",
  "/finanzen",
  "/bi",
  "/nachrichten",
  "/bea",
  "/bea/compose",
  "/einstellungen",
  "/suche",
  "/admin/benutzer",
];

function zeile(v: Result) {
  const beispiel = v.nodes[0]?.target.join(" ") ?? "–";
  const html = (v.nodes[0]?.html ?? "").replace(/\s+/g, " ").slice(0, 160);
  return `${v.impact ?? "?"} ${v.id} (${v.nodes.length}×) z. B. ${beispiel} ${html}`;
}

/** Wartet, bis die Seite zur Ruhe gekommen ist (Daten geladen, Ladeanzeigen weg). */
async function ruhig(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page
    .locator('[aria-busy="true"], .animate-pulse')
    .first()
    .waitFor({ state: "detached", timeout: 5_000 })
    .catch(() => {});
  // Ein- und Überblendungen (Glasflächen, Fade-in) abklingen lassen,
  // sonst rechnet axe Kontraste mit halber Deckkraft.
  await page.waitForTimeout(600);
}

async function pruefen(page: Page, name: string): Promise<string[]> {
  await ruhig(page);
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const blockierend = violations.filter((v) => BLOCKIEREND.has(v.impact ?? ""));
  const hinweise = violations.filter((v) => !BLOCKIEREND.has(v.impact ?? ""));
  for (const v of hinweise) console.log(`[axe] ${name}: Hinweis ${zeile(v)}`);
  for (const v of blockierend) console.log(`[axe] ${name}: VERSTOSS ${zeile(v)}`);
  return blockierend.map((v) => `${name}: ${zeile(v)}`);
}

test.describe("Barrierefreiheit (axe, WCAG 2.1 A/AA)", () => {
  test("Anmeldeseite vor der Anmeldung", async ({ page }) => {
    await page.goto("/login");
    const fehler = await pruefen(page, "/login");
    expect(fehler, fehler.join("\n")).toEqual([]);
  });

  test("Hauptseiten nach Anmeldung als Admin", async ({ page }) => {
    test.setTimeout(10 * 60_000);
    await anmelden(page, ADMIN_EMAIL, ADMIN_PASSWORT);
    const fehler: string[] = [];
    for (const seite of SEITEN) {
      let name = seite;
      if (seite === "AKTE") {
        await page.goto("/akten");
        await ruhig(page);
        const link = page.locator('main a[href^="/akten/"]:not([href="/akten/neu"])').first();
        await expect(link, "keine Akte in der Liste").toBeVisible();
        await link.click();
        await page.waitForURL(/\/akten\/[^/]+$/, { timeout: 30_000 });
        name = new URL(page.url()).pathname;
      } else {
        await page.goto(seite);
      }
      fehler.push(...(await pruefen(page, name)));
    }
    expect(fehler, fehler.join("\n")).toEqual([]);
  });
});
