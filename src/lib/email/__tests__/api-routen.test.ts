import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Every fetch("/api/…") in the email, beA and ticket UI must hit an existing
 * route handler that exports the HTTP method used. Catches calls into the void
 * such as GET /api/dokumente?… or PATCH /api/emails/[id].
 */
const ROOT = path.resolve(__dirname, "../../../..");
const API = path.join(ROOT, "src/app/api");
const BEREICH = [
  "src/components/email",
  "src/components/bea",
  "src/components/tickets",
  "src/app/(dashboard)/email",
  "src/app/(dashboard)/bea",
  "src/app/(dashboard)/tickets",
  "src/lib/email/dokument-auswahl.ts",
];

function dateien(p: string): string[] {
  const abs = path.join(ROOT, p);
  if (fs.statSync(abs).isFile()) return [abs];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? dateien(path.join(p, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(abs, e.name)] : []
  );
}

/** Resolve "/api/a/${x}/b" against src/app/api, allowing [param] directories. */
function findeRouten(url: string): string[] {
  const segs = url.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  let dirs = [API];
  for (const seg of segs) {
    const dyn = seg.includes("${");
    dirs = dirs.flatMap((d) =>
      fs.existsSync(d)
        ? fs.readdirSync(d, { withFileTypes: true })
            .filter((e) => e.isDirectory() && (e.name.startsWith("[") ? true : !dyn && e.name === seg))
            .map((e) => path.join(d, e.name))
        : []
    );
  }
  return dirs.map((d) => path.join(d, "route.ts")).filter((f) => fs.existsSync(f));
}

const FETCH = /fetch\(\s*([`"'])(\/api\/[^`"']*?)\1(?:\s*,\s*\{([\s\S]{0,200}?)\})?/g;

describe("UI-Aufrufe treffen existierende API-Routen", () => {
  const aufrufe = BEREICH.flatMap(dateien).flatMap((file) => {
    const src = fs.readFileSync(file, "utf8");
    return Array.from(src.matchAll(FETCH)).map((m) => {
      const url = m[2].split("?")[0];
      const method = /method:\s*["'](\w+)["']/.exec(m[3] ?? "")?.[1] ?? "GET";
      return { file: path.relative(ROOT, file), url, method };
    });
  });

  it("findet Aufrufe", () => {
    expect(aufrufe.length).toBeGreaterThan(20);
  });

  it.each(aufrufe.map((a) => [`${a.method} ${a.url} (${a.file})`, a] as const))("%s", (_l, a) => {
    const routen = findeRouten(a.url);
    expect(routen, `keine Route für ${a.url}`).not.toHaveLength(0);
    const exportiert = routen.some((r) =>
      new RegExp(`export (async )?function ${a.method}\\b`).test(fs.readFileSync(r, "utf8"))
    );
    expect(exportiert, `${routen.join(", ")} exportiert kein ${a.method}`).toBe(true);
  });
});
