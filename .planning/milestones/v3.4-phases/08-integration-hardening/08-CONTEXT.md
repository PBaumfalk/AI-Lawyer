# Phase 8: Integration Hardening - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Close all cross-phase integration gaps from the v3.4 5th milestone audit: RBAC enforcement on finance, ki-chat, and dashboard routes; Versand-Gate prevents sending ENTWURF documents via email and beA; beA operations are audit-logged with Pruefprotokoll UI; Finance KPI dashboard displays correct data with role-based visibility. Additionally: remove PRAKTIKANT role entirely.

</domain>

<decisions>
## Implementation Decisions

### RBAC & Rollen-Bereinigung
- PRAKTIKANT-Rolle komplett entfernen (Schema, Seed, UI, Permission-Checks) — 4 Rollen: ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT
- REQ-RS-003 ("PRAKTIKANT nur Lesen + Entwuerfe") wird obsolet
- KI-Chat (/api/ki-chat, /api/ki-chat/conversations, /api/helena/suggestions) offen fuer alle eingeloggten User — keine Rolleneinschraenkung, nur Auth-Check
- API-Routes geben 403 Forbidden bei unberechtigtem Zugriff zurueck
- Nav-Items fuer nicht-berechtigte Funktionen werden komplett versteckt (nicht ausgegraut)

### Versand-Gate
- ENTWURF-Dokumente im Attach-Dialog sichtbar aber ausgegraut mit Hinweis "Noch nicht freigegeben"
- Quick-Release-Button direkt neben gesperrtem Dokument im Attach-Dialog — Dokument kann sofort freigegeben werden ohne Workflow-Wechsel
- API gibt 400 Bad Request bei Versuch, ENTWURF-Dokument zu senden (z.B. manipulierter Request)
- Gleiche checkDokumenteFreigegeben()-Logik fuer E-Mail-Versand und beA-Versand — eine Funktion, zwei Einsatzorte

### beA Audit Logging
- ALLE beA-Aktionen loggen: Senden, Empfangen, eEB-Bestaetigung, Nachricht oeffnen, Anhang herunterladen, Safe-ID aendern, Postfach wechseln
- Ausfuehrliche Log-Eintraege: User, Aktion, Zeitstempel, Aktenzeichen, Empfaenger-Safe-ID, Dokumentenliste, Dateigroessen, Nachrichtentyp, Ergebnis (Erfolg/Fehler)
- Erfolg UND Fehler loggen — bei Fehler zusaetzlich: Fehlermeldung, Fehlercode
- Pruefprotokoll-Tab in der Aktenansicht zeigt beA-Audit-Log chronologisch an

### Finance KPI & RBAC
- Finance-API-Routes verwenden buildAkteAccessFilter() — User sieht nur Finanzdaten seiner Akten
- KPI-Card-Keys fixen (API-Response-Keys muessen mit Frontend-Keys matchen) — keine neuen KPIs
- SEKRETARIAT + SACHBEARBEITER: nur operative KPIs (offene Rechnungen, ueberfaellige Rechnungen, Fremdgeld-Saldo)
- ANWALT + ADMIN: alle KPIs (inklusive Gesamtumsatz, Gewinn, Honorarvolumen)
- ADMIN sieht immer kanzleiweite Summen
- ANWALT: kanzleiweite Finanzsicht konfigurierbar pro User — Checkbox "Kanzleiweite Finanzen" in der Benutzerverwaltung
- Angestellte Anwaelte sehen nur eigene Akten-Finanzen, Partner-Anwaelte koennen kanzleiweit freigeschaltet werden

### Claude's Discretion
- Exact Pruefprotokoll-Tab UI layout and filtering
- Quick-Release-Button design im Attach-Dialog
- Wie die "Kanzleiweite Finanzen"-Checkbox technisch ins User-Modell integriert wird
- Error-State-Handling bei 403/400 Responses im Frontend

</decisions>

<specifics>
## Specific Ideas

- Versand-Gate: ENTWURF-Dokumente sichtbar aber gesperrt — User soll sofort verstehen WARUM ein Dokument nicht anhaengbar ist
- Quick-Release direkt im Kontext, ohne Workflow-Wechsel zur Dokumentenverwaltung
- "Es gibt auch angestellte Anwaelte" — daher muss die kanzleiweite Finanzsicht pro Anwalt konfigurierbar sein, nicht pauschal fuer die Rolle
- Pruefprotokoll soll direkt in der Akte einsehbar sein, nicht nur in der DB

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-integration-hardening*
*Context gathered: 2026-02-25*
