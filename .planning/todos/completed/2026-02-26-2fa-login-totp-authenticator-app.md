---
created: 2026-02-26T23:03:15.235Z
title: 2FA Login — TOTP Authenticator-App
area: auth
files:
  - src/app/api/auth/
  - src/app/(auth)/login/
  - prisma/schema.prisma
---

## Problem

Der Login ist aktuell nur mit E-Mail + Passwort gesichert (NextAuth.js v5). Für eine Kanzleisoftware mit sensiblen Mandantendaten ist das nicht ausreichend — ein kompromittiertes Passwort reicht für vollen Zugriff. 2FA per Authenticator-App (TOTP) ist der Standard für professionelle Anwendungen in diesem Bereich.

## Solution

### Methode: TOTP (Time-based One-Time Password) per Authenticator-App

Kompatibel mit Google Authenticator, Authy, 1Password, Apple Passwords etc.
Standard: RFC 6238 / TOTP — bewährt, offline nutzbar, kein SMS-Anbieter nötig.

**Bibliothek:** `otplib` (Node.js TOTP-Implementierung, aktiv gepflegt)

---

### Flow: 2FA einrichten (pro User)

1. User öffnet Profil-Einstellungen → "2FA aktivieren"
2. Server generiert TOTP-Secret (`otplib.authenticator.generateSecret()`)
3. QR-Code wird angezeigt (Base32-Secret als `otpauth://`-URI, gerendert via `qrcode`)
4. User scannt mit Authenticator-App
5. User gibt ersten 6-stelligen Code ein → Server verifiziert → 2FA aktiviert
6. Backup-Codes (8 Stück, einmalig verwendbar) werden angezeigt + herunterladbar

### Flow: Login mit 2FA

1. E-Mail + Passwort korrekt → NextAuth-Session noch nicht erstellt
2. Zwischenschritt: "Bitte Code aus Authenticator-App eingeben"
3. 6-stelliger Code → Server verifiziert mit `otplib.authenticator.verify()`
4. Korrekt → Session erstellt, Weiterleitung ins Dashboard
5. Falsch → Fehler (max. 5 Versuche, dann kurzes Rate-Limit)

### Flow: Backup-Code verwenden

- Statt TOTP-Code kann ein Backup-Code eingegeben werden
- Backup-Code wird nach Verwendung als "verbraucht" markiert
- Wenn < 3 Backup-Codes übrig → Hinweis in Profil-Einstellungen

---

### Datenbankänderungen (Prisma)

```prisma
model User {
  // ... bestehende Felder ...
  twoFactorSecret     String?   // verschlüsselt gespeichert
  twoFactorEnabled    Boolean   @default(false)
  twoFactorBackupCodes BackupCode[]
}

model BackupCode {
  id        String   @id @default(cuid())
  userId    String
  code      String   // bcrypt-gehashed
  used      Boolean  @default(false)
  usedAt    DateTime?
  user      User     @relation(fields: [userId], references: [id])
}
```

**Sicherheit:** `twoFactorSecret` verschlüsselt in DB speichern (AES-256, Key aus Env-Variable).

---

### NextAuth.js v5 Integration

- Custom `authorize`-Callback: nach Passwort-Check prüfen ob `twoFactorEnabled`
- Wenn ja: temporäres Token mit `pending_2fa: true` (kein vollständiger Session-Zugriff)
- Separater API-Endpoint `POST /api/auth/2fa/verify` nimmt TOTP-Code + temporäres Token
- Nach Verifikation: vollständige Session erstellen

---

### UI-Komponenten

- `/profil/sicherheit` — 2FA-Einrichtungsseite (QR-Code, Verifikation, Backup-Codes)
- Login-Seite: zweiter Schritt nach erfolgreichem Passwort (separates Input-Feld, Autofocus, Numpad-Keyboard-Hint)
- Profil: Status-Anzeige ("2FA aktiv seit [Datum]"), Deaktivieren-Button (erfordert Code-Bestätigung), Backup-Codes neu generieren

---

### Admin-Kontrolle (optional)

- Admin kann für bestimmte Rollen 2FA als Pflicht setzen (z. B. ANWALT + ADMIN müssen 2FA aktiviert haben)
- Beim Login: wenn Pflicht + nicht aktiviert → Weiterleitung zur Einrichtungsseite statt Dashboard
