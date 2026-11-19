# AI-Lawyer · Persimmon v1.1

Gewählter Entwurf: 04. Logo und Iconfamilie auf hellem Milchglas.

## Start

`index.html` direkt im Browser öffnen. Es benötigt kein Internet, keine Installation und keinen Build. Enthalten sind Farbwechsel Hell/Dunkel, Iconsuche, Mono-/Akzentumschaltung, SVG-Downloads und Demonstrationen der Buttonzustände. Browser können lokale Downloads/Clipboard unterschiedlich behandeln; bei Bedarf `python3 -m http.server 8080` im entpackten Ordner starten.

## Dateien

| Ordner/Datei | Inhalt |
|---|---|
| `logos/` | A/L-Bildmarke, horizontale und gestapelte Wortmarken, Orange/Graphit/Weiß/Burnt, transparente PNGs |
| `icons/mono`, `icons/duotone` | Je 82 SVG-Icons, Standalone und Inline geeignet |
| `icons/sprite.svg` | Monochromer SVG-Sprite |
| `icons/navigation-map.json` | Zuordnung der vorhandenen Module |
| `app/` | App-Icons 16–1024 px, PWA/Maskable, Apple-Touch-Größe, Favicon SVG/ICO, Manifest |
| `tokens/` | CSS und JSON, helle und dunkle Palette, Glas- und Interaktionsregeln |
| `react/` | Typisierte Icon-, Button-, IconButton-, Badge- und Input-Vorlagen plus Beispiel |
| `templates/` | Social/Open-Graph-Vorlage SVG und 1200×630 PNG |
| `CI-CONTRACT.md` | Verbindlicher Vertrag für Gestaltung und Coding-KI |
| `IMPLEMENTATION.md` | Konkrete Integrationsschritte und Metatags |
| `docs/validation.json` | Tatsächliche Kontrastberechnungen und Prüfumfang |
| `docs/NOTICE.md` | Herkunft, Fonts und Abgrenzung |
| `tools/validate.py` | Erneute strukturelle Prüfung, ohne Zusatzpakete |

## Übergabe an eine Coding-KI

> Lies zuerst `CI-CONTRACT.md` und `IMPLEMENTATION.md`. Integriere das freigegebene Persimmon-Design in AI-Lawyer. Behalte Informationsarchitektur und fachliche Funktionen bei. Nutze SVG-Master und Design-Tokens aus diesem Paket. Ersetze die vorhandenen Icons anhand von `navigation-map.json`. Führe die im Zielrepository vorgesehenen Prüfungen aus und dokumentiere jede erforderliche Abweichung.

## Grenzen

Dies ist ein vollständiges Übergabepaket für das Erscheinungsbild, kein fertiger Pull Request. Das GitHub-Repository war nicht zugänglich und wurde nicht verändert. Die Vektoren sind die bereinigte Umsetzung des ausgewählten Mockups. React-Vorlagen müssen im Zielprojekt kompiliert und geprüft werden. Keine pauschale Behauptung von WCAG-Konformität. Für SVG per `<img>` sind Farben intern fest; dynamische Färbung erfordert Inline-SVG oder die React-Komponente.
