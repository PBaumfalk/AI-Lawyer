// Timer Logic
// Per-user timer management: start, stop, switch between Akten
// "Timer starts automatically when opening ANY Akte" (CONTEXT decision)
// One active timer at a time, with quick-switch between Akten

import { prisma } from '@/lib/db';
import type { TimerState } from './types';
import type { Zeiterfassung } from '@prisma/client';

/**
 * Start a timer for a user on a specific Akte.
 *
 * If a timer is already running for this user, it is automatically stopped
 * first (auto-save elapsed time). Only one timer can be active per user.
 *
 * @param userId - User starting the timer
 * @param akteId - Akte to track time for
 * @returns New timer state
 */
export async function startTimer(userId: string, akteId: string): Promise<TimerState> {
  // Check for existing running timer and stop it
  const existing = await prisma.zeiterfassung.findFirst({
    where: { userId, isRunning: true },
  });

  if (existing) {
    // If the timer is already for the same Akte, just return it
    if (existing.akteId === akteId) {
      const akte = await prisma.akte.findUnique({
        where: { id: akteId },
        select: { aktenzeichen: true },
      });
      return {
        zeiterfassungId: existing.id,
        akteId: existing.akteId,
        aktenzeichen: akte?.aktenzeichen ?? '',
        startzeit: existing.startzeit!,
        userId,
      };
    }

    // Stop the existing timer
    await stopTimerInternal(existing);
  }

  // Start new timer
  const akte = await prisma.akte.findUnique({
    where: { id: akteId },
    select: { aktenzeichen: true },
  });

  if (!akte) {
    throw new Error('Akte nicht gefunden');
  }

  const now = new Date();
  const entry = await prisma.zeiterfassung.create({
    data: {
      akteId,
      userId,
      datum: now,
      dauer: 0,
      beschreibung: '',
      startzeit: now,
      isRunning: true,
      abrechenbar: true,
    },
  });

  return {
    zeiterfassungId: entry.id,
    akteId: entry.akteId,
    aktenzeichen: akte.aktenzeichen,
    startzeit: now,
    userId,
  };
}

/**
 * Internal helper: stop a timer and calculate duration.
 */
async function stopTimerInternal(
  entry: Zeiterfassung,
  beschreibung?: string,
): Promise<Zeiterfassung> {
  const endzeit = new Date();
  const startzeit = entry.startzeit ?? entry.datum;
  const elapsedMs = endzeit.getTime() - startzeit.getTime();
  const dauer = Math.max(1, Math.round(elapsedMs / 60000)); // At least 1 minute

  return prisma.zeiterfassung.update({
    where: { id: entry.id },
    data: {
      isRunning: false,
      endzeit,
      dauer,
      beschreibung: beschreibung ?? entry.beschreibung ?? '',
    },
  });
}

/**
 * Stop the currently running timer for a user.
 *
 * Calculates elapsed time from startzeit to now.
 * For Stundenhonorar-Akten, beschreibung is mandatory (per user decision).
 *
 * @param userId - User stopping the timer
 * @param beschreibung - Activity description (required for Stundenhonorar)
 * @returns Completed time entry
 */
export async function stopTimer(
  userId: string,
  beschreibung?: string,
): Promise<Zeiterfassung> {
  const running = await prisma.zeiterfassung.findFirst({
    where: { userId, isRunning: true },
  });

  if (!running) {
    throw new Error('Kein aktiver Timer gefunden');
  }

  // Check if Stundenhonorar Akte requires beschreibung
  if (!beschreibung || beschreibung.trim() === '') {
    const isStundenhonorar = await isStundenhonorarAkte(running.akteId);
    if (isStundenhonorar) {
      throw new Error('Taetigkeitsbeschreibung ist Pflicht bei Stundenhonorar-Akten');
    }
  }

  return stopTimerInternal(running, beschreibung);
}

/**
 * Switch timer from current Akte to a new Akte.
 * Stops the current timer (auto-saves) and starts a new one.
 *
 * @param userId - User switching the timer
 * @param newAkteId - New Akte to track time for
 * @returns Stopped entry (if any) and new timer state
 */
export async function switchTimer(
  userId: string,
  newAkteId: string,
): Promise<{ stopped?: Zeiterfassung; started: TimerState }> {
  const running = await prisma.zeiterfassung.findFirst({
    where: { userId, isRunning: true },
  });

  let stopped: Zeiterfassung | undefined;
  if (running) {
    stopped = await stopTimerInternal(running);
  }

  const started = await startTimer(userId, newAkteId);

  return { stopped, started };
}

/**
 * Get the currently active timer for a user.
 *
 * @param userId - User ID
 * @returns Timer state or null if no timer is running
 */
export async function getActiveTimer(userId: string): Promise<TimerState | null> {
  const running = await prisma.zeiterfassung.findFirst({
    where: { userId, isRunning: true },
    include: {
      akte: { select: { aktenzeichen: true } },
    },
  });

  if (!running || !running.startzeit) return null;

  return {
    zeiterfassungId: running.id,
    akteId: running.akteId,
    aktenzeichen: running.akte.aktenzeichen,
    startzeit: running.startzeit,
    userId,
  };
}

/**
 * Check if an Akte uses Stundenhonorar (hourly billing).
 * Checks the Akte's falldaten JSON field for rechnungstyp/abrechnungsart.
 *
 * @param akteId - Akte ID to check
 * @returns true if the Akte uses hourly billing
 */
export async function isStundenhonorarAkte(akteId: string): Promise<boolean> {
  const akte = await prisma.akte.findUnique({
    where: { id: akteId },
    select: { falldaten: true },
  });

  if (!akte?.falldaten || typeof akte.falldaten !== 'object') return false;

  const fd = akte.falldaten as Record<string, any>;
  const rechnungstyp = fd.rechnungstyp ?? fd.abrechnungsart ?? '';
  return typeof rechnungstyp === 'string' && rechnungstyp.toLowerCase().includes('stundenhonorar');
}
