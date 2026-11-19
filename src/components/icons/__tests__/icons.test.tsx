import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
// Über den Alias (vitest.config.ts) – genau wie in der Anwendung
import * as Icons from "lucide-react";
import { LUCIDE_ZU_PERSIMMON, LUCIDE_GEDREHT } from "@/components/icons/lucide-compat";
import { Icon, iconNames, erweiterungsNamen, type IconName } from "@/components/icons/persimmon";
import { erweiterungsFormen } from "@/components/icons/persimmon-erweiterung";

/** Alle Icon-Namen, die die Anwendung aus "lucide-react" importiert. */
function verwendeteNamen(): string[] {
  const namen = new Set<string>();
  const lauf = (dir: string) => {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) lauf(p);
      else if (/\.tsx?$/.test(f)) {
        const s = fs.readFileSync(p, "utf8");
        for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/g)) {
          for (const teil of m[1]!.split(",")) {
            const n = teil.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]!.trim();
            if (n && !/^Lucide/.test(n)) namen.add(n);
          }
        }
      }
    }
  };
  lauf(path.resolve(__dirname, "../../.."));
  return [...namen];
}

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("Icons (Persimmon über den lucide-react-Alias)", () => {
  it("jeder in der App verwendete Name ist eine renderbare Komponente", () => {
    const namen = verwendeteNamen();
    expect(namen.length).toBeGreaterThan(100);
    const fehlend = namen.filter((n) => !(Icons as Record<string, unknown>)[n]);
    expect(fehlend).toEqual([]);
    for (const n of namen) {
      const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[n]!;
      expect(html(<C className="w-4 h-4" />)).toContain("<svg");
    }
  });

  it("zugeordnete Namen liefern die Persimmon-Form, nicht Lucide", () => {
    for (const [lucide, persimmon] of Object.entries(LUCIDE_ZU_PERSIMMON)) {
      const C = (Icons as unknown as Record<string, React.ComponentType>)[lucide]!;
      expect(html(<C />), lucide).toContain(`data-icon="${persimmon}"`);
      expect([...iconNames, ...erweiterungsNamen]).toContain(persimmon);
    }
  });

  it("Navigation laut navigation-map.json ist vollständig abgedeckt", () => {
    const nav = ["dashboard", "cases", "contacts", "calendar", "documents", "drafts", "alerts", "email", "tickets", "helena", "ai-chat", "finances", "analytics", "bea", "messages"];
    for (const n of nav) expect(iconNames).toContain(n);
  });

  it("Helena ist der Roboter mit Brille, KI-Funken werden nicht mehr gezeigt", () => {
    const helena = html(<Icons.Sparkles />);
    expect(helena).toContain('data-icon="helena"');
    // Brillengläser (zwei Kreise r=2.3) und Antenne
    expect(helena.match(/r="2.3"/g)?.length).toBe(2);
    expect(html(<Icons.Bot />)).toContain('data-icon="helena"');
  });

  it("übernimmt className, Größe, Strichstärke und Barrierefreiheit", () => {
    const s = html(<Icons.Search className="w-4 h-4 text-muted-foreground" size={16} />);
    expect(s).toContain('class="al-icon lucide lucide-search w-4 h-4 text-muted-foreground"');
    expect(s).toContain('width="16"');
    expect(s).toContain('stroke-width="1.75"');
    expect(s).toContain('aria-hidden="true"');
    const beschriftet = html(<Icon name="helena" label="Helena" tone="duotone" />);
    expect(beschriftet).toContain('role="img"');
    expect(beschriftet).toContain('aria-label="Helena"');
    expect(beschriftet).not.toContain("aria-hidden");
  });

  it("kein verwendeter Name kommt mehr nackt aus Lucide", () => {
    const nackt = verwendeteNamen().filter((n) => {
      const C = (Icons as unknown as Record<string, React.ComponentType>)[n]!;
      return !/data-icon="[a-z0-9-]+"/.test(html(<C />));
    });
    expect(nackt).toEqual([]);
    const zugeordnet = new Set([...Object.keys(LUCIDE_ZU_PERSIMMON), ...Object.keys(LUCIDE_GEDREHT)]);
    expect(verwendeteNamen().filter((n) => !zugeordnet.has(n))).toEqual([]);
  });

  it("gedrehte Ableitungen tragen Form und Drehung", () => {
    for (const [lucide, [form, grad]] of Object.entries(LUCIDE_GEDREHT)) {
      const C = (Icons as unknown as Record<string, React.ComponentType>)[lucide]!;
      const s = html(<C />);
      expect(s, lucide).toContain(`data-icon="${form}"`);
      expect(s, lucide).toContain(`transform="rotate(${grad} 12 12)"`);
    }
  });

  it("Erweiterungsicons halten die Persimmon-Regeln ein", () => {
    expect(new Set(erweiterungsNamen).size).toBe(erweiterungsNamen.length);
    expect(erweiterungsNamen.filter((n) => (iconNames as readonly string[]).includes(n))).toEqual([]);
    expect(Object.keys(erweiterungsFormen).sort()).toEqual([...erweiterungsNamen].sort());
    for (const n of erweiterungsNamen) {
      const s = html(<Icon name={n as IconName} />);
      expect(s, n).toMatch(/^<svg [^>]*viewBox="0 0 24 24"[^>]*>.*<\/svg>$/);
      expect(s, n).toContain('stroke-width="1.75"');
      expect(s, n).toContain('stroke-linecap="round"');
      expect(s, n).toContain('stroke-linejoin="round"');
      expect(s, n).toContain('fill="none"');
      const innen = s.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
      expect(innen.length, n).toBeGreaterThan(0);
      for (const m of innen.matchAll(/<([a-z]+)([^>]*)\/?>/g)) {
        expect(["path", "rect", "circle", "line", "polyline", "ellipse"], `${n}: <${m[1]}>`).toContain(m[1]);
        const attr = m[2]!;
        // Keine Füllflächen außer kleinen Punkten (r ≤ 0.6, ohne Strich)
        if (/fill="/.test(attr)) {
          expect(attr, n).toMatch(/fill="currentColor"/);
          expect(attr, n).toMatch(/stroke="none"/);
          expect(m[1], n).toBe("circle");
          expect(Number(/ r="([\d.]+)"/.exec(attr)?.[1]), n).toBeLessThanOrEqual(0.6);
        }
        // Keine eigenen Strichstärken oder Farben
        expect(attr, n).not.toMatch(/stroke-width|style=|transform=/);
      }
    }
  });

  it("ChevronUp ist das gedrehte ChevronDown", () => {
    expect(html(<Icons.ChevronUp />)).toContain('transform="rotate(180 12 12)"');
  });
});
