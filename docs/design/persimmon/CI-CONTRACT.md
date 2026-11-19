# AI-Lawyer · Persimmon — CI-Contract v1.1

Verbindliche Gestaltungsgrundlage für Menschen und Coding-KIs. Stand: 19. November 2026. Gewählte Richtung: 04 / Persimmon. Dieser Contract regelt das Erscheinungsbild; er ersetzt keine fachlichen Anforderungen. Im bestehenden Repository wurde nichts verändert. Die Umsetzung dort muss gegen die tatsächlichen Komponenten geprüft werden.

## 1. Identität und Grenzen

Produktname immer **AI-Lawyer**, mit Bindestrich. Signet ist eine geometrische A/L-Ligatur. Die SVG-Dateien sind die verbindlichen Master; das zuvor gewählte Bild ist die visuelle Referenz. Die Master sind eine manuell bereinigte Vektorinterpretation, keine automatische 1:1-Konvertierung des Rasterbilds.

Das vorhandene helle Glass Design und die Informationsarchitektur bleiben bestehen. Kein Umbau der Navigation, keine neuen Marketingelemente in Arbeitsabläufen. Keine Waage, Richterhammer oder generische KI-Funken als Ersatzlogo. Helena ist eine Funktion innerhalb von AI-Lawyer, keine zweite gleichrangige Produktmarke.

## 2. Farben und verbindliche Rollen

| Rolle | Hell | Verwendung |
|---|---|---|
| Persimmon | `#FF5C34` | Logo, primäre Aktion, kleine Markendetails |
| Burnt Orange | `#B94720` | Links, Fokus, aktive Navigation und wichtige Icon-Akzente auf hellen Flächen |
| Graphit | `#2D2A27` | Text, Standardicons, Text auf orangenen Buttons |
| Pearl | `#F8F6F2` | Anwendungsgrundfläche |
| Weiß | `#FFFFFF` | Deckende Arbeitsflächen und Glasfallback |
| Muted | `#68615B` | Sekundäre Texte |

Orange bleibt punktuell: die große Mehrheit einer Arbeitsfläche ist neutral. Kein pauschales Einfärben sämtlicher Icons. Text auf `#FF5C34` ist **Graphit**, auch in Dark Mode. Weiß auf diesem Orange ist für normalen Buttontext nicht zulässig. Die berechnete Kombination Graphit/Orange erreicht 4.64:1. Normale Links verwenden Burnt Orange, nicht das helle Markorange. Der Hoverton `#FF754F` behält Graphit als Beschriftung.

Farben aus Trendprognosen sind Inspiration; die funktionalen Abstufungen wurden für diese Oberfläche festgelegt. Keine behauptete Pantone-Übereinstimmung. Referenz: [Pinterest Palette 2026](https://business.pinterest.com/pinterest-palette/), Persimmon `#FF5C34`.

## 3. Logo

`logos/wordmark-primary.svg` für helle Flächen. `wordmark-white.svg` auf dunklen deckenden Flächen. `wordmark-graphite.svg` für einfarbige Anwendungen. `mark-primary.svg` für knappen Platz. Alle veröffentlichten Wortmarken enthalten Pfadkonturen; die gesonderte Datei `wordmark-editable.svg` enthält editierbaren Text und ist kein Master für die Auslieferung. Der Schriftzug wurde aus Arial Bold in Pfade umgesetzt; es wird keine Fontdatei mitgeliefert.

Wortmarke mindestens 132 CSS-Pixel breit, Signet mindestens 20 CSS-Pixel hoch. Favicon ab 16 Pixel nur mit Signet und auf tatsächlichen Geräten kontrollieren. Freiraum rund um das Logo: mindestens ein Viertel der Signethöhe. Nicht verzerren, drehen, mit Schatten belegen, neu setzen oder neu nachzeichnen. Bei sehr kleinen Größen sind die 16/32-Pixel-App-Exporte gegenüber frei skalierten Screenshots zu bevorzugen. Glas ist der Container, nicht Teil der flachen Bildmarke.

## 4. Glas, Layout und Typografie

Anwendungs-UI: Systemschrift über `--al-font`; es werden keine Webfonts nachgeladen. Basis 16/24 Pixel, Beschriftungen 14/20, Hilfstexte 13/20, Tabellen mindestens 14/20. Headlinegrößen 32, 24 und 20 Pixel; Gewichte 600–700. Lange Schriftsatztexte behalten die dokumenteigene Typografie. Kein dekoratives Versalsystem für Fließtext.

Abstände folgen dem 4-Pixel-Raster: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Controls Radius 12, Karten 24, große Panels 28 Pixel. Bestehende sinnvolle Layoutmaße müssen nicht blind ersetzt werden.

Glas: `rgba(255,255,255,.78)`, Blur 24 Pixel, helle Kontur, weicher neutraler Schatten. Hinter Glas nur ruhige neutral-warme Verläufe; keine Fotos oder gesättigten Farbflecken hinter Text. Wesentliche Inhalte, lange Dokumente und kritische Statusinformationen stehen auf deckenden Innenflächen (`.al-opaque`). Ohne Blur-Support oder bei reduzierter Transparenz: deckende Fläche. Keine Annahme, dass ein Kontrasttest gegen Weiß den Kontrast jeder transparenten Fläche garantiert.

## 5. Icons

82 Icons, optisches 24er-Raster, Strich 1.75, runde Enden und Verbindungen. Navigationsicons 20–24 Pixel, große Hinweise 32. Standard ist Mono und `currentColor`. Duotone nur für ausgewählte, wichtige oder illustrierende Icons. Die `.al-icon`-Klasse erhält die gewählte Größe; die React-Komponente setzt sie explizit. Nachbarsymbole nicht aus anderen Bibliotheken mischen, keine Emojis als Funktionsicons. Neue Icons halten Gewicht, Raster, Enden und optische Füllung ein.

SVG-Icons liegen in `icons/mono` und `icons/duotone`. Navigation-Zuordnung in `icons/navigation-map.json`. Sprite bewusst **monochrom**. Wer variable Akzente benötigt, nutzt die React-Komponente oder Inline-SVG; `<img>` vererbt keine CSS-Farbe aus dem Host-Dokument. Für Inline-SVG kann `stroke` über `currentColor` gesteuert werden. Alle Icons sind hier eigens gezeichnete einfache Geometrien; es wurde kein Fremdiconpaket eingebunden.

Dekorative Icons: `aria-hidden=true`; bedeutungstragende Icons haben ein verständliches Label. Icon-only Buttons benötigen einen zugänglichen Namen. Warnungen nie ausschließlich durch Farbe anzeigen. Helena erhält einen freundlichen, abgerundeten Roboterkopf mit runder Brille, zwei Augen und einem Lächeln. Die Brille und die Antennenspitze tragen in Duotone den Orange-Akzent; Mono verwendet ausschließlich die Textfarbe. KI-Chat bleibt eine Dialogblase mit Knoten; beide müssen in der Navigation beschriftet bleiben. Das bisherige abstrakte Helena-Zeichen ist ersetzt und darf nicht neu eingebunden werden.

## 6. Buttons und Interaktion

Primär = Orange/Graphit, Sekundär = deckende Glasgrundfarbe/Kontur, Ghost = Burnt-Orange-Text, Destruktiv = Rot/Weiß. Maximal eine dominante Primäraktion je Arbeitsbereich. „Löschen“ niemals Orange als alleinige Gefahrkennzeichnung. Primäre Buttonhöhe mindestens 44 Pixel; kompakte 36-Pixel-Buttons nur bei Maus/Tastatur und genügend Abstand, Touchziele mindestens 44 Pixel. Icon-only Buttons 44×44.

Alle Controls haben Default, Hover, Active, Focus-visible und Disabled. Asynchrone Aktionen sperren Mehrfachauslösung, zeigen lesbaren Fortschritt und `aria-busy`. Texte beschreiben die Aktion: „Neue Akte“, „Entwurf prüfen“, „Speichern“. Animationen 120–240 ms; Reduced Motion deaktiviert nicht notwendige Bewegung. Keine laufenden Glanz- oder Pulsanimationen im regulären Arbeitsplatz.

Aktive Navigation: sehr heller Orangenhintergrund, Burnt-Orange-Text, linke Markierung, `aria-current=page`. Tastaturfokus: 3-Pixel-Ring, Abstand 3 Pixel, kontrastreiche Farbe. Die Anwendung darf für Bedienelemente vorhandene bewährte Bibliotheken weiterverwenden; deren visuelle Werte werden auf diese Tokens abgebildet.

## 7. Status, Formulare und KI

| Status | Farbe | Pflichtkennzeichnung |
|---|---|---|
| Erfolg/Freigabe | Grün | „Freigegeben“ oder bestätigendes Icon plus Text |
| Prüfung/Hinweis mit Handlungsbedarf | Amber | „Prüfung erforderlich“ |
| Fehler/überfällig/destruktiv | Rot | Konkrete Fehlermeldung oder „Überfällig“ |
| Information | Blau | Klarer Hinweistext |
| Entwurf/Markenauswahl | Orange | „Entwurf“ oder aktive Navigation |

Orange als Marke nicht mit amberfarbenen Warnungen verwechseln. Grün oder ein KI-Ergebnis impliziert keine automatische juristische Richtigkeit. KI-Ergebnisse bleiben als Entwurf gekennzeichnet, bis die bestehende Freigabelogik erfüllt ist. Quellen und offene Angaben müssen auffindbar bleiben. Keine rein dekorativen Vertrauens- oder Sicherheitsversprechen.

Inputs haben sichtbare Labels. Fehler zusätzlich als Text und `aria-invalid` sowie `aria-describedby`. Platzhalter ersetzt kein Label. Leere Zustände: kurzer konkreter Satz und passende nächste Aktion. Tabellen behalten erkennbare Zeilenstruktur und klare Statusangaben.

## 8. Dunkle Variante und PWA

Hell bleibt Standard. Dark Mode ist eine Ergänzung über `data-theme=dark`, nicht automatisch aktiviert. Dunkle Grundfläche `#191715`, Surface `#24211E`, Text `#F5F0EB`. Brand bleibt Orange, Texte auf orangenen Buttons bleiben Graphit. Links und Focus verwenden aufgehelltes Orange. Für Tests Referenz `tokens/design-tokens.json`.

App-Icons sind quadratisch mit deckendem Hintergrund. Ecken werden vom Betriebssystem maskiert; keine doppelt abgerundeten transparenten Maskable-Icons erzeugen. Maskable-Datei nutzt eine zurückgenommene Bildmarke innerhalb der zentralen sicheren Kreisfläche. `site.webmanifest` geht von einer App unter `/` und Assets unter `/brand/` aus: bei Unterpfaden **id, scope, start_url und Iconpfade gemeinsam anpassen**. Die Hintergrund- und Themefarbe ist Pearl; Metatags dürfen für Dark Mode separat gesetzt werden.

## 9. Coding-KI: Umsetzungsvorgaben

1. Bestehende Struktur, AGENTS.md und Designsystem im Zielrepository lesen.
2. Tokens als zentrale Quelle importieren; keine zweite parallele Farbpalette schaffen.
3. Logos und Icons kopieren; vorhandene Module anhand der Zuordnung ersetzen.
4. Komponenten visuell anpassen und fachliche Funktionen erhalten. Keine Änderung von Akten-, Fristen-, Benutzer-, Rechte- oder KI-Logik aus diesem Designauftrag ableiten.
5. Dark Mode und reduzierte Bewegung/Transparenz prüfen. Im wirklichen Hintergrundaufbau Text- und Fokuskontraste messen.
6. Responsive Breiten 375, 768 und 1440 prüfen, Tastaturnavigation und 200-%-Zoom manuell prüfen. Keine pauschale Barrierefreiheitszertifizierung aus diesen Dateien ableiten.
7. Repository-Tests und Typecheck ausführen. Die beigefügten React-Dateien sind Integrationsvorlagen für React 18/19 mit TypeScript und wurden hier nicht im Zielprojekt kompiliert.
8. Keine externen Schrift-, Icon- oder Analysedienste hinzufügen. Keine Lizenz- oder Markenrechteprüfung behaupten.

## 10. Abnahme

Verwendbare SVG-Master ohne externe Abhängigkeiten; Icons einheitlich; PWA-Dateien passend zum tatsächlichen Deploymentpfad; primäre und sekundäre Aktionen unterscheidbar; Fokus sichtbar; Status nicht nur farblich; Glass Design bei fehlendem Blur lesbar; Orange sparsam; keine neuen fachlichen Funktionen. `docs/validation.json` dokumentiert tatsächlich berechnete Farbpaare. Paketprüfung und Berechnung sind keine Prüfung des laufenden Zielprodukts.
