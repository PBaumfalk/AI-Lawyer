import { test, expect } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORT, adresse, anmelden, foto, keinUeberlauf } from "./hilfen";

test.describe("Benutzerverwaltung (Admin)", () => {
  test.beforeEach(async ({ page }) => {
    await anmelden(page, ADMIN_EMAIL, ADMIN_PASSWORT);
  });

  test("Liste, Anlegen mit Fehler und Erfolg, Startpasswort, Entsperren, Zurücksetzen", async ({ page, browser }, info) => {
    await page.goto("/admin/benutzer");
    await expect(page.getByRole("heading", { name: "Benutzer" })).toBeVisible();
    await expect(page.getByText(ADMIN_EMAIL)).toBeVisible();
    await keinUeberlauf(page);
    await foto(page, info, "benutzer-liste");

    // Anlegen: doppelte Adresse → Fehlermeldung im Dialog
    await page.getByRole("button", { name: "Neues Konto" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Name", { exact: true })).toBeFocused();
    await dialog.getByLabel("Name", { exact: true }).fill("Doppelt");
    await dialog.getByLabel("E-Mail (Anmeldename)").fill(ADMIN_EMAIL);
    await dialog.getByRole("button", { name: "Konto anlegen" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await foto(page, info, "benutzer-anlegen-fehler");

    // Anlegen: Erfolg → Startpasswort einmalig
    const email = adresse(info, "neu");
    await dialog.getByLabel("Name", { exact: true }).fill("Rita Refa");
    await dialog.getByLabel("E-Mail (Anmeldename)").fill(email);
    await dialog.getByLabel("Rolle").selectOption("SACHBEARBEITER");
    await dialog.getByLabel("Position (optional)").fill("ReFa");
    await foto(page, info, "benutzer-anlegen-dialog");
    await dialog.getByRole("button", { name: "Konto anlegen" }).click();
    const pwDialog = page.getByRole("dialog", { name: "Startpasswort" });
    await expect(pwDialog).toBeVisible();
    const startpasswort = (await pwDialog.locator("code").innerText()).trim();
    expect(startpasswort).toMatch(/^[a-z0-9]{4}(-[a-z0-9]{4}){3}$/i);
    await keinUeberlauf(page);
    await foto(page, info, "benutzer-startpasswort");
    await pwDialog.getByRole("button", { name: "Fertig" }).click();
    await expect(pwDialog).toBeHidden();
    const zeile = page.getByRole("row").filter({ hasText: email });
    await expect(zeile).toBeVisible();

    // Entsperren: Rückmeldung als Toast
    await zeile.getByRole("button", { name: "Entsperren" }).click();
    await expect(page.getByText("Anmeldesperre für Rita Refa aufgehoben")).toBeVisible();
    await foto(page, info, "benutzer-entsperrt");

    // Neues Konto kann sich anmelden
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await anmelden(p2, email, startpasswort);
    await ctx.close();

    // Zurücksetzen: Bestätigungsdialog, neues Startpasswort
    await zeile.getByRole("button", { name: "Passwort zurücksetzen" }).click();
    const reset = page.getByRole("dialog", { name: "Passwort zurücksetzen" });
    await expect(reset).toBeVisible();
    await foto(page, info, "benutzer-zuruecksetzen-dialog");
    await reset.getByRole("button", { name: "Neues Passwort erzeugen" }).click();
    await expect(page.getByRole("dialog", { name: "Startpasswort" })).toBeVisible();
    const neu = (await page.getByRole("dialog", { name: "Startpasswort" }).locator("code").innerText()).trim();
    expect(neu).not.toBe(startpasswort);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Deaktivieren per Schalter
    await zeile.getByRole("switch", { name: "Rita Refa deaktivieren" }).click();
    await expect(page.getByText("Rita Refa gespeichert")).toBeVisible();
    await expect(zeile.getByRole("switch")).not.toBeChecked();
    await foto(page, info, "benutzer-deaktiviert");
  });

  test("Sachbearbeitung sieht die Seite nicht und erhält von der API 403", async ({ page, browser }, info) => {
    const email = adresse(info, "sb");
    const res = await page.request.post("/api/admin/benutzer", { data: { email, name: "Sven SB", role: "SACHBEARBEITER" } });
    const { startpasswort } = await res.json();
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await anmelden(p, email, startpasswort);
    const api = await p.request.get("/api/admin/benutzer");
    expect(api.status()).toBe(403);
    await p.goto("/admin/benutzer");
    await expect(p.getByText(ADMIN_EMAIL)).toHaveCount(0);
    await foto(p, info, "benutzer-als-sachbearbeitung");
    await ctx.close();
  });
});
