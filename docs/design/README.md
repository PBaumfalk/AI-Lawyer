# Design: Persimmon

AI-Lawyer verwendet das Designsystem **Persimmon v1.1** (Richtung „04 / Persimmon“: warmes Orange, Graphit, helle Glasflächen). Verbindlich ist der [CI-Contract](persimmon/CI-CONTRACT.md). Dieses Dokument beschreibt, wie das Designpaket in der Anwendung umgesetzt ist und wo Abweichungen bestehen.

![Markenübersicht](persimmon/brand-overview.png)

## Inhalt dieses Ordners

| Datei | Inhalt |
| --- | --- |
| [`persimmon/CI-CONTRACT.md`](persimmon/CI-CONTRACT.md) | Verbindliche Gestaltungsregeln: Farben, Logo, Glas, Icons, Buttons, Status, Dark Mode |
| [`persimmon/IMPLEMENTATION.md`](persimmon/IMPLEMENTATION.md) | Integrationsschritte aus dem Paket |
| [`persimmon/PAKET-README.md`](persimmon/PAKET-README.md), [`NOTICE.md`](persimmon/NOTICE.md), [`CHANGELOG.md`](persimmon/CHANGELOG.md) | Paketbeschreibung, Herkunft, Versionen |
| [`persimmon/design-tokens.json`](persimmon/design-tokens.json), [`persimmon.css`](persimmon/persimmon.css) | Token-Referenz des Pakets (die Anwendung bindet sie über `globals.css` ein, siehe unten) |
| [`persimmon/navigation-map.json`](persimmon/navigation-map.json), [`catalog.json`](persimmon/catalog.json) | Zuordnung Navigation → Icon, Liste der 82 Icons |
| [`persimmon/validation.json`](persimmon/validation.json) | Im Paket berechnete Kontrastpaare |

## Umsetzung in der Anwendung

| Bereich | Ort | Hinweise |
| --- | --- | --- |
| Tokens | `src/app/globals.css` | `--al-*` sind die einzige Farbquelle (hell und `.dark`). Die shadcn-Variablen (`--primary`, `--background` …) und die Tailwind-Skala `brand-*` verweisen darauf. |
| Tailwind | `tailwind.config.ts` | `primary` (`hover`, `foreground`, `strong`, `soft`), `brand-50…950` (500 = Persimmon `#FF5C34`, 600 = Burnt Orange `#B94720`), `success`/`warning`/`danger`/`info` mit `-soft`, Radien `2xl` = 24 px, `3xl` = 28 px, Systemschrift |
| Glas | `globals.css` (`.glass-card`, `.glass-panel`, `.glass-panel-elevated`, `.glass-sidebar`) | Blur 24 px nur, wenn der Browser es kann; sonst und bei `prefers-reduced-transparency` deckende Fläche. `forced-colors` erhält Konturen. |
| Fokus | `globals.css` | 3-px-Ring in `--al-focus`, Abstand 3 px, für alle fokussierbaren Elemente |
| Bewegung | `globals.css` | Übergänge 180 ms; bei `prefers-reduced-motion` keine Animationen |
| Logo, App-Icons, Manifest | `public/brand/`, `src/components/brand/brand-logo.tsx`, `src/app/layout.tsx` | Wortmarke hell/dunkel, Signet bei eingeklappter Sidebar, Favicon SVG/ICO, Apple-Touch-Icon, `site.webmanifest`, `theme-color`. `/brand` ist von der Anmeldepflicht ausgenommen (`src/middleware.ts`). |
| Icons | `src/components/icons/` | Siehe nächster Abschnitt |
| Komponenten | `src/components/ui/` | Button (Primär Orange mit Graphit-Text, 44 px, `loading` mit `aria-busy`), Input/Select/Textarea (44 px, `aria-invalid`), Badge mit Statusfarben, Tabs, Switch, Dialoge und Sheets (deckend, auf kleinen Bildschirmen scrollbar) |
| Navigation | `src/components/layout/sidebar.tsx` | Icons nach `navigation-map.json`, aktiver Eintrag mit hellem Orange, Burnt-Orange-Text, linker Markierung und `aria-current="page"` |
| Theme | `src/components/providers/theme-provider.tsx` | Hell ist Standard; Dunkel nur nach ausdrücklicher Wahl (Sidebar „Dunkler Modus“). Die Systemeinstellung schaltet nicht automatisch um. |

## Icons

Die 82 Persimmon-Icons liegen als React-Komponente in `src/components/icons/persimmon.tsx` (Formen unverändert aus dem Paket in `persimmon-shapes.tsx`):

```tsx
import { Icon } from "@/components/icons/persimmon";

<Icon name="cases" className="w-5 h-5" />                  // dekorativ, aria-hidden
<Icon name="helena" tone="duotone" label="Helena" />       // bedeutungstragend, mit Akzent
```

Bestehender und neuer Code importiert weiterhin aus `lucide-react`. Dieser Import ist in `next.config.mjs` (webpack und turbopack) und `vitest.config.ts` per Alias auf `src/components/icons/lucide-compat.tsx` umgeleitet:

- Lucide-Namen mit fachlicher Entsprechung (Tabelle `LUCIDE_ZU_PERSIMMON`) liefern die Persimmon-Form, z. B. `FolderOpen` → Akten, `Bot`/`Sparkles` → Helena, `Loader2` → Laden.
- Alle anderen bleiben Lucide-Icons und erhalten per CSS dieselbe Strichstärke (1,75).
- Helena ist der Roboterkopf mit runder Brille. KI-Funken (`Sparkles`) und die Waage (`Scale`) werden nicht mehr gezeigt.

Ein Unit-Test (`src/components/icons/__tests__/icons.test.tsx`) prüft, dass jeder in der Anwendung verwendete Icon-Name auflöst und die Zuordnungen die Persimmon-Form liefern.

## Regeln für neuen Code

- Farben nur über Tokens: `bg-primary text-primary-foreground` für die eine Hauptaktion je Bereich, `text-primary-strong` für Links und Akzente, `success`/`warning`/`danger`/`info` für Status, sonst neutrale Töne. Keine neuen Hex- oder `oklch()`-Werte in Komponenten.
- Text auf Orange ist immer Graphit (`text-primary-foreground`), nie Weiß.
- Status nie nur über Farbe: immer Text oder Icon dazu („Überfällig“, „Entwurf“).
- Icon-only-Buttons brauchen `aria-label`.
- KI-Ergebnisse bleiben als Entwurf gekennzeichnet, bis sie freigegeben sind.

## Abweichungen und offene Punkte

- **Lucide-Icons ohne Persimmon-Entsprechung** (z. B. Globus, Drucker, Taschenrechner) bleiben in der Oberfläche. Der Contract wünscht keine Nachbarsymbole aus anderen Bibliotheken; Ersatz entsteht im Designpaket, nicht in der Anwendung.
- **Kategoriefarben** (z. B. Lila/Indigo für Dokumenttypen, Farben in BI-Diagrammen) sind beibehalten, weil sie Kategorien unterscheiden, nicht die Marke darstellen.
- **beA-Komponenten** (`src/components/bea/`) werden im Zuge der beA-Anbindung auf die Tokens umgestellt.
- **Gamification** behält ihre eigenen Farben.
- **Breite Tabellen** scrollen auf schmalen Bildschirmen in ihrem eigenen Container.
- Barrierefreiheit: Kontraste der Tokens sind berechnet (Graphit auf Persimmon 4,64:1, Burnt Orange auf Pearl 4,88:1); eine vollständige WCAG-Prüfung ist das nicht.
