import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
// Über den Alias (vitest.config.ts) – genau wie in der Anwendung
import * as Icons from "lucide-react";
import { LUCIDE_ZU_PERSIMMON } from "@/components/icons/lucide-compat";
import { Icon, iconNames } from "@/components/icons/persimmon";

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
      expect(iconNames).toContain(persimmon);
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

  it("nicht zugeordnete Icons bleiben Lucide-Komponenten", () => {
    const s = html(<Icons.Globe />);
    expect(s).toContain("lucide-globe");
    expect(s).not.toContain("data-icon");
  });

  it("ChevronUp ist das gedrehte ChevronDown", () => {
    expect(html(<Icons.ChevronUp />)).toContain('transform="rotate(180 12 12)"');
  });
});
