/**
 * Default Fristen-Presets
 *
 * Common German legal deadline presets for quick selection.
 * Each preset defines the FristArt, duration, whether it's a Notfrist,
 * default Vorfristen, and category.
 */

import type { FristPreset } from './types'

export const DEFAULT_FRISTEN_PRESETS: FristPreset[] = [
  // === Zivilprozess ===
  {
    name: 'Berufungsfrist',
    rechtsgrundlage: '§ 517 ZPO',
    fristArt: 'EREIGNISFRIST',
    dauer: { monate: 1 },
    istNotfrist: true,
    defaultVorfristen: [7, 3, 1],
    kategorie: 'zivilprozess',
  },
  {
    name: 'Berufungsbegruendungsfrist',
    rechtsgrundlage: '§ 520 Abs. 2 ZPO',
    fristArt: 'EREIGNISFRIST',
    dauer: { monate: 2 },
    istNotfrist: false,
    defaultVorfristen: [14, 7, 3],
    kategorie: 'zivilprozess',
  },
  {
    name: 'Revisionsfrist',
    rechtsgrundlage: '§ 548 ZPO',
    fristArt: 'EREIGNISFRIST',
    dauer: { monate: 1 },
    istNotfrist: true,
    defaultVorfristen: [7, 3, 1],
    kategorie: 'zivilprozess',
  },
  {
    name: 'Revisionsbegruendungsfrist',
    rechtsgrundlage: '§ 551 Abs. 2 ZPO',
    fristArt: 'EREIGNISFRIST',
    dauer: { monate: 2 },
    istNotfrist: false,
    defaultVorfristen: [14, 7, 3],
    kategorie: 'zivilprozess',
  },
  {
    name: 'Einspruchsfrist (Versaeumnisurteil)',
    rechtsgrundlage: '§ 339 Abs. 1 ZPO',
    fristArt: 'EREIGNISFRIST',
    dauer: { wochen: 2 },
    istNotfrist: true,
    defaultVorfristen: [7, 3, 1],
    kategorie: 'zivilprozess',
  },
  {
    name: 'Klageerwiderungsfrist',
    rechtsgrundlage: '§ 276 Abs. 1 ZPO',
    fristArt: 'EREIGNISFRIST',
    dauer: { wochen: 2 },
    istNotfrist: false,
    defaultVorfristen: [7, 3, 1],
    kategorie: 'zivilprozess',
  },
  {
    name: 'Klagefrist',
    rechtsgrundlage: '§ 586 Abs. 1 ZPO',
    fristArt: 'EREIGNISFRIST',
    dauer: { monate: 1 },
    istNotfrist: true,
    defaultVorfristen: [7, 3, 1],
    kategorie: 'zivilprozess',
  },
  {
    name: 'Beschwerdeschrift',
    rechtsgrundlage: '§ 569 Abs. 1 ZPO',
    fristArt: 'EREIGNISFRIST',
    dauer: { wochen: 2 },
    istNotfrist: true,
    defaultVorfristen: [7, 3, 1],
    kategorie: 'zivilprozess',
  },
  {
    name: 'Rechtsbeschwerdeschrift',
    rechtsgrundlage: '§ 575 Abs. 1 ZPO',
    fristArt: 'EREIGNISFRIST',
    dauer: { monate: 1 },
    istNotfrist: true,
    defaultVorfristen: [7, 3, 1],
    kategorie: 'zivilprozess',
  },

  // === Verwaltungsrecht ===
  {
    name: 'Widerspruchsfrist',
    rechtsgrundlage: '§ 70 Abs. 1 VwGO',
    fristArt: 'EREIGNISFRIST',
    dauer: { monate: 1 },
    istNotfrist: false,
    defaultVorfristen: [7, 3, 1],
    kategorie: 'verwaltungsrecht',
  },
  {
    name: 'Klagefrist (Verwaltungsrecht)',
    rechtsgrundlage: '§ 74 Abs. 1 VwGO',
    fristArt: 'EREIGNISFRIST',
    dauer: { monate: 1 },
    istNotfrist: false,
    defaultVorfristen: [7, 3, 1],
    kategorie: 'verwaltungsrecht',
  },
  {
    name: 'Antrag auf Zulassung der Berufung',
    rechtsgrundlage: '§ 124a Abs. 4 VwGO',
    fristArt: 'EREIGNISFRIST',
    dauer: { monate: 1 },
    istNotfrist: false,
    defaultVorfristen: [7, 3, 1],
    kategorie: 'verwaltungsrecht',
  },

  // === Strafrecht ===
  {
    name: 'Berufungsfrist (Strafrecht)',
    rechtsgrundlage: '§ 314 StPO',
    fristArt: 'EREIGNISFRIST',
    dauer: { wochen: 1 },
    istNotfrist: false,
    defaultVorfristen: [3, 1],
    kategorie: 'strafrecht',
  },
  {
    name: 'Revisionsfrist (Strafrecht)',
    rechtsgrundlage: '§ 341 StPO',
    fristArt: 'EREIGNISFRIST',
    dauer: { wochen: 1 },
    istNotfrist: false,
    defaultVorfristen: [3, 1],
    kategorie: 'strafrecht',
  },

  // === Arbeitsrecht ===
  {
    name: 'Kuendigungsschutzklage',
    rechtsgrundlage: '§ 4 KSchG',
    fristArt: 'EREIGNISFRIST',
    dauer: { wochen: 3 },
    istNotfrist: false,
    defaultVorfristen: [7, 3, 1],
    kategorie: 'arbeitsrecht',
  },

  // === Allgemein ===
  {
    name: 'Widerspruchsfrist',
    rechtsgrundlage: '§ 355 BGB',
    fristArt: 'EREIGNISFRIST',
    dauer: { wochen: 2 },
    istNotfrist: false,
    defaultVorfristen: [7, 3, 1],
    kategorie: 'allgemein',
  },
  {
    name: 'Anfechtungsfrist',
    rechtsgrundlage: '§ 124 BGB',
    fristArt: 'EREIGNISFRIST',
    dauer: { jahre: 1 },
    istNotfrist: false,
    defaultVorfristen: [30, 14, 7],
    kategorie: 'allgemein',
  },
  {
    name: 'Verjährungsfrist (regelmässig)',
    rechtsgrundlage: '§ 195 BGB',
    fristArt: 'EREIGNISFRIST',
    dauer: { jahre: 3 },
    istNotfrist: false,
    defaultVorfristen: [90, 30, 14],
    kategorie: 'allgemein',
  },
]
