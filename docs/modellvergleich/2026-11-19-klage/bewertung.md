# Klagevergleich vom 19.11.2026: Bewertung

Blind bewertet von Patrick Baumfalk. Fiktive Akte, alle Varianten hinter der Datenschutz-Schleuse, je ein Lauf.

| | Variante | Modell | Länge | Note |
|---|---|---|---|---|
| A | Helenas Schriftsatz-Ablauf (Muster, Gesetze, Stammdaten, Rückfragen beantwortet) | Claude Opus 5.5 | 18.000 Zeichen | 1 |
| B | Einzelaufruf (nur Dokumente) | waterfall-2.0 | 7.800 Zeichen | 2 |
| C | Einzelaufruf | Claude Opus 5.5 | 7.900 Zeichen | 4 |
| D | Helenas Schriftsatz-Ablauf | waterfall-2.0 | 10.600 Zeichen | 4 |

Formal erfüllten A, B und C alle fünf Prüfpunkte, D vier von fünf.

**Auffällig an A**
- Die „Rechtliche Würdigung“ umfasst 12.500 Zeichen und ist im Gutachtenstil geschrieben („A. Zulässigkeit der Klage …“). Das passt nicht in eine Klageschrift.
- Fehlende Angaben sind als `{{ERGAENZUNG: …}}` markiert statt als `[FEHLT: …]`.

D ist ebenfalls gutachterlich gegliedert („Anspruchsgrundlage 1“), aber deutlich kürzer.

**Vorläufig, wegen nur einem Lauf je Variante**
- Beide Spitzenwerte (4) liegen über der besten Klage des ersten Vergleichs (3).
- Ob der Ablauf mit Muster besser ist als der Einzelaufruf oder Opus besser als waterfall, lässt sich aus je einem Lauf nicht ableiten.
- Helenas Abschnitts-Prompts für die rechtliche Würdigung erzeugen Gutachtenstil statt Schriftsatzstil.
