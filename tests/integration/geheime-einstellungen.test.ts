import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { getSettingTyped, invalidateSettingsCache, updateSetting } from "@/lib/settings/service";
import { resetDb, createUser, asUser, req } from "./helpers";

const KEY = "ai.provider.apiKey";
let admin: any;

beforeEach(async () => {
  await resetDb();
  invalidateSettingsCache();
  admin = await createUser("ADMIN");
});

const raw = async () => (await prisma.systemSetting.findUnique({ where: { key: KEY } }))?.value;

describe("Geheime Einstellungen (KI-API-Schlüssel)", () => {
  it("liegen verschlüsselt in der Datenbank und lassen sich lesen", async () => {
    await updateSetting(KEY, "sk-geheim-123");
    expect(await raw()).toMatch(/^enc:v1:/);
    expect(await raw()).not.toContain("sk-geheim-123");
    expect(await getSettingTyped(KEY, "")).toBe("sk-geheim-123");
  });

  it("alte Klartextwerte bleiben lesbar", async () => {
    await prisma.systemSetting.create({ data: { key: KEY, value: "sk-alt", type: "string", category: "ai", label: "x" } });
    expect(await getSettingTyped(KEY, "")).toBe("sk-alt");
  });

  it("verlassen den Server weder über /api/settings noch über den Export", async () => {
    await updateSetting(KEY, "sk-geheim-123");
    asUser(admin);
    const { GET } = await import("@/app/api/settings/route");
    const { GET: EXPORT } = await import("@/app/api/einstellungen/export/route");
    const a = JSON.stringify(await (await GET()).json());
    const b = JSON.stringify(await (await EXPORT()).json());
    for (const s of [a, b]) {
      expect(s).not.toContain("sk-geheim-123");
      expect(s).not.toContain("enc:v1:");
    }
    const exp = JSON.parse(b).systemSettings.find((s: any) => s.key === KEY);
    expect(exp).toMatchObject({ value: "", secret: true, secretSet: true });
  });

  it("ein leerer Wert beim Speichern behält den Schlüssel, ein neuer ersetzt ihn", async () => {
    await updateSetting(KEY, "sk-erst");
    asUser(admin);
    const { POST } = await import("@/app/api/einstellungen/import/route");
    const imp = (value: string) =>
      POST(req("/api/einstellungen/import", { method: "POST", json: { version: "1.0", systemSettings: [{ key: KEY, value, type: "string", category: "ai", label: "x" }] } }));
    await imp("");
    expect(await getSettingTyped(KEY, "")).toBe("sk-erst");
    await imp("sk-neu");
    // Import goes through updateSetting: cache invalidated, value visible at once
    expect(await getSettingTyped(KEY, "")).toBe("sk-neu");
    expect(await raw()).toMatch(/^enc:v1:/);
  });
});
