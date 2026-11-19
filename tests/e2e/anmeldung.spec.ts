import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { ADMIN_EMAIL, ADMIN_PASSWORT, adresse, anmelden, foto, keinUeberlauf, meldung } from "./hilfen";

test.describe("Anmeldung", () => {
  test("Grundzustand: Beschriftungen, Lesbarkeit, kein Überlauf", async ({ page }, info) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Anmeldung" })).toBeVisible();
    await expect(page.getByRole("img", { name: "AI-Lawyer" }).first()).toBeVisible();
    await expect(page.getByLabel("E-Mail-Adresse")).toBeVisible();
    await expect(page.getByLabel("Passwort")).toBeVisible();
    await keinUeberlauf(page);
    await foto(page, info, "login-leer");
  });

  test("Pflichtfelder: leeres Absenden schickt nichts ab", async ({ page }, info) => {
    await page.goto("/login");
    let anfragen = 0;
    page.on("request", (r) => r.url().includes("/api/auth/totp/init") && anfragen++);
    await page.getByRole("button", { name: "Anmelden" }).click();
    const meldung = await page.getByLabel("E-Mail-Adresse").evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(meldung).not.toBe("");
    await page.getByLabel("E-Mail-Adresse").fill("keine-adresse");
    await page.getByRole("button", { name: "Anmelden" }).click();
    expect(await page.getByLabel("E-Mail-Adresse").evaluate((el: HTMLInputElement) => el.validity.typeMismatch)).toBe(true);
    expect(anfragen).toBe(0);
    await foto(page, info, "login-validierung");
  });

  test("Tastatur: Tab-Reihenfolge, sichtbarer Fokus, Enter meldet an", async ({ page }, info) => {
    await page.goto("/login");
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("E-Mail-Adresse")).toBeFocused();
    const ring = await page.getByLabel("E-Mail-Adresse").evaluate((el) => {
      const s = getComputedStyle(el);
      return `${s.outlineStyle} ${s.boxShadow}`;
    });
    expect(ring === "none none", "Fokus ist nicht sichtbar").toBe(false);
    await foto(page, info, "login-fokus");
    await page.keyboard.type(ADMIN_EMAIL);
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Passwort")).toBeFocused();
    await page.keyboard.type(ADMIN_PASSWORT);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Anmelden" })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await keinUeberlauf(page);
    await foto(page, info, "dashboard-nach-login");
  });

  test("falsches Passwort: verständliche, vorgelesene Fehlermeldung", async ({ page }, info) => {
    await page.goto("/login");
    await page.getByLabel("E-Mail-Adresse").fill(ADMIN_EMAIL);
    await page.getByLabel("Passwort").fill("falsches-passwort");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(meldung(page)).toHaveText("Ungültige Anmeldedaten. Bitte versuchen Sie es erneut.");
    await expect(page.getByRole("button", { name: "Anmelden" })).toBeEnabled();
    await keinUeberlauf(page);
    await foto(page, info, "login-fehler");
  });

  test("Ladezustand: Knopf gesperrt mit Hinweis", async ({ page }, info) => {
    await page.goto("/login");
    await page.route("**/api/auth/totp/init", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.getByLabel("E-Mail-Adresse").fill("niemand@e2e.kanzlei-test.de");
    await page.getByLabel("Passwort").fill("egal-egal");
    await page.getByRole("button", { name: "Anmelden" }).click();
    const knopf = page.getByRole("button", { name: "Anmeldung..." });
    await expect(knopf).toBeDisabled();
    await foto(page, info, "login-laedt");
    await expect(meldung(page)).toBeVisible();
  });

  test("Netzwerkfehler: Meldung statt hängendem Knopf", async ({ page }, info) => {
    await page.goto("/login");
    await page.route("**/api/auth/totp/init", (route) => route.abort("internetdisconnected"));
    await page.getByLabel("E-Mail-Adresse").fill(ADMIN_EMAIL);
    await page.getByLabel("Passwort").fill("egal-egal");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(meldung(page)).toContainText("Server ist nicht erreichbar");
    await expect(page.getByRole("button", { name: "Anmelden" })).toBeEnabled();
    await foto(page, info, "login-netzfehler");
  });

  test("Drosselung: nach 10 Fehlversuchen Wartehinweis, auch mit richtigem Passwort", async ({ page }, info) => {
    const email = adresse(info, "drossel");
    await page.goto("/login");
    for (let i = 0; i < 10; i++) {
      await page.getByLabel("E-Mail-Adresse").fill(email);
      await page.getByLabel("Passwort").fill(`falsch-${i}`);
      await page.getByRole("button", { name: "Anmelden" }).click();
      await expect(meldung(page)).toHaveText(/Ungültige Anmeldedaten/);
    }
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(meldung(page)).toHaveText("Zu viele Anmeldeversuche. Bitte in 15 Minuten erneut versuchen.");
    await keinUeberlauf(page);
    await foto(page, info, "login-gedrosselt");
  });

  test("Hinweis nach Passwortwechsel", async ({ page }, info) => {
    await page.goto("/login?passwort=geaendert");
    await expect(page.getByRole("status")).toHaveText("Passwort geändert. Bitte mit dem neuen Passwort anmelden.");
    await foto(page, info, "login-passwort-geaendert");
  });

  test("Anmeldeschutz ausgefallen (Redis gestoppt): Hinweis statt Anmeldung, Wiederkehr automatisch", async ({ page }, info) => {
    const container = process.env.E2E_REDIS_CONTAINER;
    test.skip(!container, "E2E_REDIS_CONTAINER nicht gesetzt (Redis-Container der Testumgebung)");
    await page.goto("/login");
    execFileSync("docker", ["stop", container!]);
    try {
      await page.getByLabel("E-Mail-Adresse").fill(ADMIN_EMAIL);
      await page.getByLabel("Passwort").fill(ADMIN_PASSWORT);
      await page.getByRole("button", { name: "Anmelden" }).click();
      await expect(meldung(page)).toHaveText(/Anmeldeschutz nicht erreichbar/);
      await expect(page).toHaveURL(/\/login/);
      await keinUeberlauf(page);
      await foto(page, info, "login-anmeldeschutz-ausgefallen");
    } finally {
      execFileSync("docker", ["start", container!]);
    }
    await expect(async () => {
      await page.getByRole("button", { name: "Anmelden" }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 3000 });
    }).toPass({ timeout: 30_000 });
  });
});

test.describe("Eigenes Passwort ändern", () => {
  test("Validierung, falsches aktuelles Passwort, Erfolg mit Neuanmeldung", async ({ page, browser }, info) => {
    // Eigenes Konto für diesen Test, angelegt vom Admin
    const admin = await browser.newContext();
    const ap = await admin.newPage();
    await anmelden(ap, ADMIN_EMAIL, ADMIN_PASSWORT);
    const email = adresse(info, "pwwechsel");
    const res = await ap.request.post("/api/admin/benutzer", { data: { email, name: "Paula Probe", role: "ANWALT" } });
    expect(res.status()).toBe(201);
    const { startpasswort } = await res.json();
    await admin.close();

    await anmelden(page, email, startpasswort);
    await page.goto("/einstellungen");
    await page.getByRole("tab", { name: /Sicherheit/ }).click();
    const aktuell = page.getByLabel("Aktuelles Passwort");
    await expect(aktuell).toBeVisible();
    await keinUeberlauf(page);
    await foto(page, info, "einstellungen-sicherheit");

    await aktuell.fill(startpasswort);
    await page.getByLabel("Neues Passwort", { exact: true }).fill("ein-neues-langes-pw");
    await page.getByLabel("Neues Passwort wiederholen").fill("ein-anderes-langes-pw");
    await page.getByRole("button", { name: "Passwort ändern" }).click();
    await expect(meldung(page)).toHaveText("Die beiden neuen Passwörter stimmen nicht überein");
    await foto(page, info, "passwort-wiederholung-falsch");

    await aktuell.fill("ganz-falsches-pw");
    await page.getByLabel("Neues Passwort wiederholen").fill("ein-neues-langes-pw");
    await page.getByRole("button", { name: "Passwort ändern" }).click();
    await expect(meldung(page)).toHaveText("Das aktuelle Passwort ist falsch");
    await foto(page, info, "passwort-aktuell-falsch");

    await aktuell.fill(startpasswort);
    await page.getByRole("button", { name: "Passwort ändern" }).click();
    await page.waitForURL(/\/login\?passwort=geaendert/, { timeout: 30_000 });
    await expect(page.getByRole("status")).toBeVisible();
    await anmelden(page, email, "ein-neues-langes-pw");
  });
});
