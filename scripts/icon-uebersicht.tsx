// Übersichtsseite aller Persimmon-Icons (Paket + Erweiterung) in 24 und 48 px.
//
//   npx tsx scripts/icon-uebersicht.tsx [ausgabe.png]
//
// Rendert die Icons mit react-dom/server und fotografiert die Seite mit
// Playwright (Chrome). Standardausgabe: docs/design/persimmon-erweiterung.png
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import path from "node:path";
import { Icon, iconNames, erweiterungsNamen, type IconName } from "../src/components/icons/persimmon";

const ziel = path.resolve(process.argv[2] ?? "docs/design/persimmon-erweiterung.png");

function Kachel({ name }: { name: IconName }) {
  return (
    <div className="k">
      <div className="i">
        <Icon name={name} size={24} />
        <Icon name={name} size={48} tone="duotone" />
      </div>
      <div className="n">{name}</div>
    </div>
  );
}

function Seite() {
  return (
    <main>
      <h1>Persimmon-Icons</h1>
      <h2>Paket ({iconNames.length})</h2>
      <div className="g">{iconNames.map((n) => <Kachel key={n} name={n} />)}</div>
      <h2>Erweiterung ({erweiterungsNamen.length})</h2>
      <div className="g">{erweiterungsNamen.map((n) => <Kachel key={n} name={n} />)}</div>
    </main>
  );
}

const css = `
body{margin:0;background:#fbf8f5;color:#2b2a28;font:12px/1.3 system-ui,sans-serif}
main{padding:24px;width:1400px}
h1{font-size:20px;margin:0 0 8px}h2{font-size:15px;margin:20px 0 8px}
.g{display:grid;grid-template-columns:repeat(12,1fr);gap:6px}
.k{background:#fff;border:1px solid #eadfd6;border-radius:8px;padding:8px 4px;text-align:center}
.i{display:flex;align-items:center;justify-content:center;gap:12px;height:52px}
.i svg:last-child{outline:1px dashed #f0d9c8}
svg[data-tone=duotone] [data-accent]{stroke:#e0662a}
.n{margin-top:4px;color:#6b645d;font-size:11px}`;

async function main() {
  const html = `<!doctype html><meta charset="utf-8"><style>${css}</style>${renderToStaticMarkup(<Seite />)}`;
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1448, height: 800 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.screenshot({ path: ziel, fullPage: true });
  await browser.close();
  console.log(ziel);
}

void main();
