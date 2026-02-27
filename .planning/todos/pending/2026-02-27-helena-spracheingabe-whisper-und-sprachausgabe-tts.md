---
created: 2026-02-27T00:00:00.000Z
title: Helena — Spracheingabe (Whisper) und Sprachausgabe (TTS)
area: ui
files:
  - src/components/ki/chat-input.tsx
  - src/components/ki/chat-messages.tsx
  - src/app/api/ki-chat/
---

## Problem

Helena ist nur per Tastatur bedienbar. Für Kanzleialltag (Telefonnotizen, schnelle Diktate, Hände-frei-Situationen) fehlen Spracheingabe und Sprachausgabe.

## Solution

### 1. Spracheingabe: OpenAI Whisper

Mic-Button im ChatInput → Aufnahme → Whisper → Text ins Eingabefeld.

**Flow:**
1. Nutzer klickt Mikrofon-Button in `chat-input.tsx`
2. Browser MediaRecorder API nimmt auf (WebM/Opus)
3. Stop → Audio-Blob → `POST /api/ki-chat/transcribe` (Whisper `whisper-1`)
4. Transkript landet im Eingabefeld (editierbar vor dem Senden)
5. Optional: Auto-Send nach Stille-Erkennung (konfigurierbar)

**API-Endpoint:** `src/app/api/ki-chat/transcribe/route.ts`
```typescript
// FormData mit audio-Blob → openai.audio.transcriptions.create()
// Gibt { text: string } zurück
```

**UI:**
- Mic-Button neben Send-Button
- Aufnahme-Zustand: pulsierender roter Ring
- Stop: automatisch bei Stille (VAD) oder manuell

---

### 2. Sprachausgabe: OpenAI TTS

Helena-Antworten werden vorgelesen — auf Knopfdruck oder automatisch.

**Stimme:** `nova` (weiblich, natürlich — passt zu Helenas Persönlichkeit)
**Modell:** `tts-1` (Latenz-optimiert) oder `tts-1-hd` (höhere Qualität)

**API-Endpoint:** `src/app/api/ki-chat/speak/route.ts`
```typescript
// POST { text: string } → openai.audio.speech.create() → Audio-Stream zurück
```

**Flow:**
1. Nach Helena-Antwort: Lautsprecher-Icon erscheint an der Nachricht
2. Klick → `POST /api/ki-chat/speak` mit Nachrichtentext
3. Audio wird gestreamt + direkt abgespielt (Web Audio API)
4. Während Wiedergabe: Pause/Stop-Button

**Modi:**
- **Manuell** (default): Lautsprecher-Icon per Klick
- **Auto-Play** (optional, Toggle in Einstellungen): jede Helena-Antwort wird automatisch vorgelesen

---

### UI-Ergänzungen

**ChatInput (`chat-input.tsx`):**
- Mic-Button links vom Send-Button
- Aufnahme-Indikator (roter Puls + Sekunden-Zähler)
- Transkript erscheint im Textfeld (mit Cursor am Ende)

**ChatMessages (`chat-messages.tsx`):**
- Lautsprecher-Icon an jeder Helena-Nachricht (erscheint beim Hover)
- Aktive Wiedergabe: animiertes Wellen-Icon + Stop-Button
- Bereits abgespielte Nachrichten: gedämpftes Icon

**Einstellungen (Profil):**
- Auto-Play TTS: Ein/Aus
- Stimme wählbar (nova / alloy / shimmer)
- Spracheingabe-Sprache: Deutsch (default) / Automatisch

---

### Implementierungsreihenfolge

1. `/api/ki-chat/transcribe` Endpoint (Whisper)
2. Mic-Button + MediaRecorder in `chat-input.tsx`
3. `/api/ki-chat/speak` Endpoint (TTS)
4. Lautsprecher-Icon + Audio-Playback in `chat-messages.tsx`
5. Auto-Play Toggle in Profil-Einstellungen
