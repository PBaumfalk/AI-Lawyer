/**
 * Every static internal link in the UI (href="/…", href={`/…`}, router.push,
 * router.replace, window.location.href = "/…", redirect("/…")) must point to an
 * existing page in src/app. Catches dead links such as /dashboard/… (the
 * (dashboard) folder is a route group and not part of the URL) or /posteingang.
 *
 * Template-literal segments ${…} are treated as dynamic segments.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "../..");
const APP = path.join(SRC, "app");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "__tests__") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** URL patterns of all pages/route handlers, as segment arrays. */
function routePatterns(): string[][] {
  const result: string[][] = [];
  for (const file of walk(APP)) {
    const base = path.basename(file);
    if (!/^(page|route)\.(ts|tsx)$/.test(base)) continue;
    const rel = path.relative(APP, path.dirname(file));
    const segs = rel === "" ? [] : rel.split(path.sep).filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith("@"));
    result.push(segs);
  }
  return result;
}

function matches(pattern: string[], url: string[]): boolean {
  let i = 0;
  for (let p = 0; p < pattern.length; p++) {
    const seg = pattern[p];
    if (/^\[\[?\.\.\./.test(seg)) return seg.startsWith("[[") || i < url.length;
    if (i >= url.length) return false;
    if (/^\[.*\]$/.test(seg)) {
      i++;
      continue;
    }
    if (url[i] === "*") return false; // a dynamic link value cannot match a fixed segment reliably
    if (seg !== decodeURIComponent(url[i])) return false;
    i++;
  }
  return i === url.length;
}

interface Link {
  file: string;
  line: number;
  url: string;
}

const LINK_RE =
  /(?:href\s*=\s*\{?\s*|router\.(?:push|replace)\(\s*|window\.location\.href\s*=\s*|redirect\(\s*)(["'`])(\/[^"'`\s]*)\1/g;

function collectLinks(): Link[] {
  const links: Link[] = [];
  for (const file of walk(SRC)) {
    if (file.includes(`${path.sep}app${path.sep}api${path.sep}`)) continue;
    const src = fs.readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    while ((m = LINK_RE.exec(src))) {
      let url = m[2];
      if (url.startsWith("/api/") || url.startsWith("//")) continue;
      url = url.replace(/\$\{[^}]*\}/g, "*").split(/[?#]/)[0];
      links.push({ file: path.relative(SRC, file), line: src.slice(0, m.index).split("\n").length, url });
    }
  }
  return links;
}

/**
 * Known dead links outside this fix's scope (Finanzen), reported separately.
 * Remove an entry once fixed; the test fails if an entry is no longer dead.
 */
const KNOWN_DEAD = new Set([
  "components/finanzen/aktenkonto-ledger.tsx → /dokumente/*",
]);

describe("interne Links", () => {
  const patterns = routePatterns();
  const links = collectLinks();

  it("findet Links und Routen", () => {
    expect(patterns.length).toBeGreaterThan(30);
    expect(links.length).toBeGreaterThan(30);
  });

  it("jeder statische Link zeigt auf eine existierende Seite", () => {
    const dead = links.filter((l) => {
      const segs = l.url.split("/").filter(Boolean);
      // "*" segments only match dynamic route segments
      return !patterns.some((p) => matches(p, segs.map((s) => (s.includes("*") && s !== "*" ? "*" : s))));
    });
    const key = (d: Link) => `${d.file} → ${d.url}`;
    expect(dead.filter((d) => !KNOWN_DEAD.has(key(d))).map((d) => `${d.file}:${d.line} → ${d.url}`)).toEqual([]);
    const stillDead = new Set(dead.map(key));
    expect(Array.from(KNOWN_DEAD).filter((k) => !stillDead.has(k))).toEqual([]);
  });
});
