import { expect, type Page, type TestInfo } from "@playwright/test";
import path from "node:path";

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "chefin@kanzlei-test.de";
export const ADMIN_PASSWORT = process.env.E2E_ADMIN_PASSWORD ?? "";

/** Bildschirmfoto für die Sichtprüfung (Pfad: E2E_SCREENSHOT_DIR/<projekt>-<name>.png). */
export async function foto(page: Page, info: TestInfo, name: string) {
  const dir = process.env.E2E_SCREENSHOT_DIR ?? "test-results/screens";
  await page.screenshot({ path: path.join(dir, `${info.project.name}-${name}.png`), fullPage: true });
}

/**
 * Kein waagerechter Überlauf (z. B. auf 390 px Breite): weder die Seite noch
 * der Inhaltsbereich <main>, dessen Überlauf sonst still abgeschnitten wird.
 */
export async function keinUeberlauf(page: Page) {
  const m = await page.evaluate(() => {
    const main = document.querySelector("main");
    return {
      breite: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      mainScroll: main ? main.scrollWidth : 0,
      mainBreite: main ? main.clientWidth : 0,
    };
  });
  expect(m.breite, "Seite ist breiter als der Bildschirm").toBeLessThanOrEqual(m.viewport + 1);
  expect(m.mainScroll, "Inhalt ist breiter als der Inhaltsbereich").toBeLessThanOrEqual(m.mainBreite + 1);
}

export async function anmelden(page: Page, email: string, passwort: string) {
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill(passwort);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

/** Eindeutige Adresse je Test und Projekt. */
export function adresse(info: TestInfo, teil: string) {
  return `${teil}-${info.project.name}-${Date.now()}@e2e.kanzlei-test.de`;
}

/** Sichtbare Fehlermeldung (role=alert); der leere Route-Announcer von Next.js zählt nicht. */
export function meldung(page: Page) {
  return page.getByRole("alert").filter({ hasText: /\S/ });
}
