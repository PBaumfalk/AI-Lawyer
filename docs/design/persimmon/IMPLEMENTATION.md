# Integration

## 1. Assets

`logos/`, `app/` und bei Bedarf `icons/` nach `public/brand/` kopieren. CSS in den bestehenden Build aufnehmen. Die App-Assetpfade im Manifest erwarten `/brand/app/`; unter einem Basispfad alle Manifest-URLs, id, scope und start_url anpassen.

```html
<link rel="icon" type="image/svg+xml" href="/brand/app/favicon.svg">
<link rel="icon" href="/brand/app/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/brand/app/app-icon-180.png">
<link rel="manifest" href="/brand/app/site.webmanifest">
<meta name="theme-color" content="#F8F6F2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#191715" media="(prefers-color-scheme: dark)">
```

Pfade von Open-Graph-Metatags müssen in der produktiven App absolute eigene URLs sein. Die gelieferten Social-Vorlagen enthalten keine Produktionsdomain.

## 2. React

Dateien aus `react/` in den vorhandenen Komponentenbaum kopieren, Importpfade anpassen, CSS genau einmal laden. Erwartet React 18 oder 19, TypeScript und JSX-Transform der vorhandenen Anwendung. Neue Abhängigkeiten werden nicht benötigt. Das Paket liefert keine eigene React-Runtime und keinen Lockfile.

```tsx
import './brand/persimmon.css';
import {Button, Icon, Input} from './brand/index'; // lokale Exportstruktur anpassen

<Button icon="plus">Neue Akte</Button>
<Icon name="cases" size={24} />
<Input label="Aktenzeichen" placeholder="00010/26" />
```

Für Next.js oder andere Server-Component-Frameworks: interaktive Client-Komponenten in die bestehenden Client-Grenzen einordnen; Eventhandler ausschließlich in Client-Komponenten verwenden. `Input` verwendet `React.useId`. Die Dateien sind kein vorkompiliertes NPM-Paket. Ohne React kann die App unmittelbar die SVG-Dateien und CSS-Klassen nutzen.

## 3. SVG

```html
<img src="/brand/logos/wordmark-primary.svg" alt="AI-Lawyer" width="176" height="35">
<svg class="al-icon" aria-hidden="true"><use href="/brand/icons/sprite.svg#cases"></use></svg>
```

Der externe Sprite ist monochrom. Für die zweifarbige Variante die Standalone-Datei oder Inline-Komponente verwenden. Icon-only Buttons beschriften. Ein bestehender Tooltip ersetzt den zugänglichen Namen nicht.

## 4. Theme und Layout

`al-root` auf den App-Container setzen, für Dark Mode `data-theme="dark"` auf `html` oder denselben übergeordneten Container. Die Produktvorgabe und Benutzerwahl entscheiden über das Theme; keine automatische Umstellung aus dem Paket ableiten. Systemschrift verwenden. `.al-glass` ist dekorative Rahmung, `.al-opaque` dient kritischen Inhalten. Icons verwenden `currentColor`; farbige Akzente sind ausdrücklich opt-in.

## 5. Prüfung

`python3 tools/validate.py` prüft gelieferte XMLs, PNG-Header, Katalog und Prüfsummen. Für die Anwendung zusätzlich deren Typecheck, Tests, Tastaturbedienung, Zoom und echte Kontraste prüfen. Ein Paketcheck ist kein Anwendungstest. Vorhandene CI- und AGENTS-Regeln gelten weiterhin.
