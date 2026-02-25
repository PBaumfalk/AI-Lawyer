# Phase 2: Deadline Calculation + Document Templates - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Attorneys can calculate legally correct deadlines with automatic weekend/holiday extension per BGB Sections 187-193, receive configurable pre-deadline reminders with escalation, and create documents from templates with auto-filled placeholders and firm letterhead, exportable as PDF. Includes stable WOPI/OnlyOffice rebuild with Track Changes, Comments, and multi-user collaboration. Calendar enhancements (Tagesübersicht, Vorfristen, Prioritäten, Wiedervorlagen) and Kanzlei-Einstellungen infrastructure are part of this phase.

</domain>

<decisions>
## Implementation Decisions

### Fristenrechner Interaction

- **Location:** Both sidebar tool (Sheet/Modal ~600px) AND inline in calendar event form. Sidebar accessible via Cmd+K and dedicated keyboard shortcut.
- **Result display:** Detailed breakdown showing: start date, raw end date, holidays/weekends that caused shifts, final end date, Vorfrist dates, Halbfrist — PLUS auto-suggest linking to an Akte with option to immediately create Frist as calendar entry.
- **Input form:** Presets (admin-verwaltbar in Kanzlei-Einstellungen) + manual fields. All fields editable. Presets auto-fill duration but can be overridden.
- **Both directions:** Forward (Zustellung → Fristende) AND backward (Fristende → spätester Zustellungstermin).
- **Bundesland:** Per-Frist Instanz/Gericht field. Auto-derived from Akte's Gericht if linked. Kanzlei-default (NRW) as fallback. All 16 Bundesländer supported with correct Feiertage.
- **Notfristen:** Visually highlighted with warning color (rot) + "NOTFRIST" badge. Additional warning: "Diese Frist ist nicht verlängerbar."
- **Batch calculation:** One Zustellungsdatum, multiple Fristtypen selectable. All results in overview, all saveable as calendar entries at once.
- **Sonderfälle:** Öffentliche Zustellung, Auslandszustellung (EU-ZustVO) supported as additional options.
- **Validation warning:** If user modifies duration from preset default, yellow hint: "Die übliche Dauer für [Fristtyp] ist [X]. Sie haben [Y] eingetragen."
- **Halbfrist:** Shown as optional display in result + automatically created as Vorfrist for deadlines > 2 weeks.
- **Historie:** Last 10 calculations remembered in sidebar tool.
- **Fristenzettel:** Printable PDF in two formats: (1) daily overview (all deadlines today/this week, sorted by urgency) and (2) per-Akte (all running deadlines of a case). Both with Aktenzeichen, Fristtyp, Zustellung, Fristende, Vorfristen, Bundesland, Verantwortlicher.
- **Fristen-Presets:** Admin-managed in Kanzlei-Einstellungen. Each preset: name, Fristtyp (Ereignis/Beginn), default duration, Notfrist flag, default Vorfristen.

### Warn-Ampel & Status

- **Color coding:** Grün (>7 Tage), Gelb (3-7 Tage), Rot (<3 Tage), Schwarz (überschritten). Applied everywhere Fristen are shown.
- **Erledigte Fristen:** Remain visible in calendar (greyed out with status). Filterable to hide.
- **Erledigungsgrund:** MANDATORY field when marking a Frist as done. Dropdown (Schriftsatz eingereicht, Frist verlängert, Rücknahme, etc.) + Freitext. Logged in Audit-Trail.
- **Überschrittene Fristen:** Sofortige Eskalation — Verantwortlicher + Vertreter + Admin get alarm notification. Prominent in Dashboard. Pflicht-Kommentar required to close (reason for Überschreitung, stored in Audit-Trail for Haftpflichtversicherung).

### Fristenverwaltung Workflows

- **Fristverlängerung:** Dedicated workflow. Button "Frist verlängern" on existing deadline: enter new duration, old Fristende stays as history, new Fristende calculated, all Vorfristen + Halbfrist automatically recalculated.
- **Fristenkontrolle:** Attorney MUST be notified to review entered deadlines. Nicht-quittierte Fristen remain visible as "ungeprüft".
- **Keine Akte ohne Frist/WV:** Validation rule — warning when a case has neither Frist nor Wiedervorlage.
- **Auto-Wiedervorlage:** When new document is added to case, automatically create Wiedervorlage with priority "Dringend".
- **Termine-Verlegung:** Dedicated workflow. Button "Termin verlegt": new date, old date stays as "verlegt" in history.
- **Termin-Checkliste:** Optional configurable checklist per Gerichtstermin (e.g., "Schriftsatz eingereicht", "Akte geprüft", "Mandant informiert"). Templates definable in Kanzlei-Einstellungen.
- **Konflikterkennung:** Warning when two Gerichtstermine overlap or an attorney is double-booked.
- **Wiederkehrende Termine:** Serientermine for regular meetings (daily/weekly/monthly/custom).
- **Dokument-Verknüpfung:** Multiple documents from Akten-DMS attachable to Fristen and Termine (e.g., Ladung, Schriftsatz, Vollmacht).

### Vertretung & Urlaub

- **Vertreter-Feld:** Each user gets a Vertreter (deputy) field in user management.
- **Vertretungs-Modus:** Admin or attorney activates vacation: Zeitraum + Vertreter. All Fristen/Termine appear for Vertreter (marked "Vertretung für A").
- **Jahresurlaub:** Users enter vacation dates. Automatically considered for Fristen/WV/Termine and Vertretung.
- **Zuweisung:** Verantwortlicher (Anwalt) + Sachbearbeiter auto-inherited from Akte, editable per Frist.

### Fristen-Dashboard & Statistik

- **Dashboard pro Anwalt:** Admin/Kanzleileitung sees: open deadlines per attorney, due this week, Notfristen. Detect overload.
- **Fristen-Statistik:** Einhaltungsquote, Überschreitungen pro Anwalt, häufigste Fristtypen, trend over time. Exportable.
- **Jahresbericht:** Automatic yearly report PDF for Haftpflichtversicherung: all deadlines, Einhaltungsquote, Überschreitungen + Begründungen.
- **Export:** iCal (.ics) for individual deadlines + CSV/Excel for deadline lists.

### Vorfristen & Reminder Flow

- **Configuration:** Global defaults (7/3/1 days) + overridable per Fristtyp-Preset + overridable per individual Frist. Halbfrist automatically added as Vorfrist for deadlines > 2 weeks.
- **Calculation:** Based on Kalendertage (not Arbeitstage). If Vorfrist falls on weekend/holiday, shifted to previous Arbeitstag.
- **Delivery channels:** (1) In-App Toast + Bell notification (Socket.IO), (2) Dashboard-Widget highlight, (3) E-Mail notification (activated after Phase 3), (4) Vorfrist as own calendar entry with reference to Hauptfrist.
- **Pflicht-Quittierung:** Vorfristen must be acknowledged by the Verantwortlicher. Unquittierte Vorfristen appear red in Dashboard.
- **Eskalation:** Configurable in Kanzlei-Einstellungen. After X hours unquittiert → Vertreter notified. After Y hours → Admin/Kanzleileitung notified.
- **Überschrittene Frist Eskalation:** Immediate alarm to Verantwortlicher + Vertreter + Admin.
- **Benachrichtigungseinstellungen:** Admin-managed only. Users cannot modify their own notification settings (prevents accidentally disabling critical deadline notifications).
- **Kanzlei-Arbeitszeiten:** Admin defines working hours (e.g., Mo-Fr 7:00-19:00). Notifications outside working hours held until next start of business.
- **Auto-Neuberechnung:** When deadline is extended, all Vorfristen + Halbfrist automatically recalculated. Old Vorfristen marked as "veraltet".
- **Fristtypen:** No distinction between "gerichtliche" and "interne" Fristen — all treated equally. Urgency controlled via 5-level priority system.
- **Wöchentlicher Report:** Automatic Monday morning report to Admin/Kanzleileitung (overview: new deadlines, due deadlines, overdue, unquittierte Vorfristen).

### Tagesübersicht

- **Location:** Dashboard-Widget (not separate page). Prominent on the main dashboard.
- **Content:** Three categories: Fristen (with Ampel), Wiedervorlagen (own color), Termine (with Uhrzeit + Ort + Bemerkungen like "Persönliches Erscheinen des Klägers angeordnet").
- **Sorted:** By urgency/time.

### Wiedervorlagen-Workflow

- **Creation:** Quick-Create from anywhere: Akte, E-Mail, Dokument, Kalender. Minimal form: Betreff + Datum + Verantwortlicher.
- **Visual distinction:** Fristen = red-toned (haftungsrelevant), Wiedervorlagen = blue/yellow-toned (Erinnerung). Different icons in calendar.
- **Delegation:** WV can be assigned to other users. Delegatee gets notification. Creator sees status.
- **Wiederkehrende WV:** Series possible (daily/weekly/monthly/custom). New WV auto-created when previous is completed.
- **Kategorien:** Admin-configurable categories (Intern, Mandant, Gericht, Versicherung, Behörde, etc.) with colors.
- **Ergebnis-Feld:** Optional result/comment when completing WV (e.g., "Mandant angerufen — vereinbart: Termin am 15.03."). Shown in Akte-Chronologie.
- **Ticket-Verknüpfung:** WV can be linked to Tickets. When WV completed, linked Ticket updated.
- **Overview:** Integrated in Kalender + Dashboard-Widget (no separate WV page).

### Template Browsing & Generation

- **Template overview:** Karten-Übersicht with categories. Search field on top. Modern card-based layout, not file-tree.
- **Search:** Volltext search across all templates (name, description, tags). Tags like "Familienrecht", "ZPO", "Mietrecht" for filtering.
- **Favoriten:** Personal favorites per user. Favorites shown at top + "Zuletzt verwendet" section.
- **Freigabe-Workflow:** Anyone can create template drafts. Only Admin/Anwalt can "freigeben" to make available for all.
- **Generation flow:** 4-step Wizard: (1) Select template, (2) Select Akte/Mandant, (3) Fill custom fields, (4) Preview + Confirm. Checkbox "In OnlyOffice öffnen" in last step (default on).
- **Custom fields:** Each template can define own additional fields (Text, Number, Date, Dropdown). Appear as Wizard step 3.
- **Conditional sections:** Templates support If/Else blocks and loops (docxtemplater). Complex templates adapt automatically.
- **Versionierung:** Full versioning. Every change creates new version. Old versions archived + accessible. Documents remember which version they were created with.
- **Editor:** Hybrid — OnlyOffice as base editor + additional Toolbar/Sidebar showing all available placeholders, insertable per click.
- **Auto-naming:** Filename auto-generated from Aktenzeichen + Vorlagentyp + Parteien + Datum. Editable before save.
- **Target folder:** User chooses folder in Akte (with suggestion based on template category).
- **Quick-Create:** Button "Neues Dokument" in Akte view. Wizard starts with Akte + Mandant pre-filled.
- **Starter-Set:** 10-20 standard templates shipped with app (Klageschrift, Vollmacht, Mahnung, etc.). Customizable/deletable.
- **Ordner-Schemata:** Configurable per Rechtsgebiet in Kanzlei-Einstellungen. Applied when creating new Akte. (e.g., "Zivilrecht": Schriftsätze, Korrespondenz, Vollmachten, Rechnungen).

### Briefkopf & PDF Export

- **Multiple Briefköpfe:** Multiple letterheads possible (per Standort, per team). Selected during document creation/export.
- **Editor:** Both options: (1) Structured form (logo upload, firm data, address, phone, bank details, tax number, BRAO info) and (2) Full DOCX editing in OnlyOffice for complete control.
- **Layout:** Logo + firm name at top + contact details/BRAO info in right sidebar (modern layout).
- **Pagination:** First page: full letterhead. Following pages: minimal header (firm name + page number) + footer.
- **PDF Export:** Dialog with options: choose Briefkopf (if multiple), PDF/A format optional, watermark optional (e.g., "ENTWURF").
- **Dokument-Status-Workflow:** Entwurf → In Prüfung → Freigegeben → Versendet. Freigabe only by Anwalt.
- **Schreibschutz:** Document is read-only after "Freigegeben". Only Anwalt can set it back to "In Bearbeitung".

### WOPI Session Behavior

- **Disconnect:** Auto-reconnect + local buffer. Changes buffered locally, synced on reconnect. Warning "Offline — Änderungen werden gespeichert wenn Verbindung wiederhergestellt".
- **Auto-Save:** Every 30 seconds.
- **Long sessions:** Automatic token refresh before expiry. Session stays open indefinitely while user is active. Lock regularly renewed.
- **Multi-User:** Real-time collaboration (Co-Editing). No locks — both users edit simultaneously. Cursors + names visible.
- **User limit:** No limit on concurrent editors (realistically max 3-5 in a law firm).
- **Track Changes:** Full support. Attorney sees marked changes, can accept/reject. Revision history accessible.
- **Comments:** Full workflow — discussion threads in documents, resolvable, answerable.
- **Versioning:** Automatic version created when user closes document (all intermediate saves consolidated). Named manual snapshots also possible. Old versions viewable + restorable (restore creates new version, old preserved).

### Kanzlei-Einstellungen

- **Organization:** Tab-based with categories. Left sidebar: Allgemein, Fristen, Vorlagen, Briefköpfe, Benachrichtigungen, Benutzer. Each tab shows relevant settings. VS Code Settings style.
- **Save behavior:** Auto-Save (like Notion). Changes immediately effective.
- **Audit:** All settings changes logged in Audit-Trail (who, when, what, old value, new value).
- **Reset:** "Auf Standard zurücksetzen" button per tab. Confirmation dialog before reset.
- **Onboarding-Wizard:** First login: guided setup (5-7 steps) for essential settings (Kanzleidaten, Briefkopf, Bundesland, Vorfristen, Ordner-Schema, Benutzer). Skippable.
- **Import/Export:** Settings exportable/importable as JSON. For multi-instance or backup.

### Fristen in Akte-Ansicht

- **Display:** Both — dedicated "Fristen & Termine" tab AND integration in Akte-Chronologie.
- **Tab content:** Full Fristen-Ansicht with Ampel-Farbe, Typ, Fristende, Vorfristen with Quittierungs-Status, Verantwortlicher, Instanz/Gericht. Quick-Actions (Erledigen, Verlängern).
- **Akte-Header:** Prominent display of next deadline with Ampel-Farbe at top of case detail page. Immediately visible without scrolling.
- **Chronologie:** Complete case history — past + future. Erledigte Fristen, vergangene Termine (with results), plus open deadlines and future appointments. All document activities included (created, edited, versions, status changes, PDF exports).
- **Filters:** Type-filter (Fristen, WV, Termine, Dokumente, Notizen, Kommunikation) + Zeitraum-filter (last week, last month, all). Multi-select.
- **Aktenliste:** Each Akte shows next deadline date + Ampel-Farbe. Sortable by "nächste Frist". Überfällige Akten sofort sichtbar.

### Claude's Discretion

- Command Palette (Cmd+K) implementation details and keyboard shortcut assignments
- Exact spacing, typography, and animation details
- Loading skeleton designs
- Error state handling for edge cases
- Exact auto-naming pattern for generated documents
- Compression/optimization of PDF exports
- WOPI token refresh timing and lock renewal intervals
- Exact color codes for WV categories
- Starter-Set template content and formatting

</decisions>

<specifics>
## Specific Ideas

- Fristenrechner should feel like a daily-use power tool for attorneys — fast, reliable, always accessible
- Tagesübersicht: "Morgens öffnen → alles sehen" — the first thing an attorney checks
- Termine should support remarks like "Persönliches Erscheinen des Klägers angeordnet"
- Ladung (court summons document) attachable to Gerichtstermin for quick access before court
- The Fristenkontrolle system is central: "Der Anwalt ist immer verantwortlich" — the system must enforce this
- KI-Agent (OpenClaw, Phase 6) should later pre-define deadlines from Schriftsätze — this phase builds the foundation
- Briefkopf layout: modern right sidebar style (not classic footer-only)
- Warn-Ampel colors align with existing design system risk colors (niedrig=emerald, mittel=amber, hoch=rose)
- Settings should feel like VS Code Settings — tab-based, searchable, auto-saving

</specifics>

<deferred>
## Deferred Ideas

- **Täglicher Fristenzettel per E-Mail:** Auto-send to all attorneys/Sachbearbeiter daily. Requires Phase 3 SMTP. Activate after Phase 3.
- **E-Mail-Trigger für Wiedervorlage:** New email in case → auto-create urgent Wiedervorlage. Requires Phase 3 email system.
- **Fristenbüro-Modus:** Specialized view for dedicated deadline staff. Deferred — Phase 6 KI-Agent should handle automated deadline pre-definition.
- **Personalakte:** Personnel file feature in user management for Admin/Kanzleileitung. Own phase or v2.
- **Akte-Zeitleiste Integration (extended):** Fristen in full case timeline with email integration. Partially in Phase 2 (documents), fully after Phase 3 (emails).
- **Rechtsmittel-Kette:** Track connected deadlines as logical chain (Urteil → Berufungsfrist → Berufungsbegründungsfrist → Erwiderung). Future enhancement.

</deferred>

---

*Phase: 02-deadline-calculation-document-templates*
*Context gathered: 2026-02-24*
