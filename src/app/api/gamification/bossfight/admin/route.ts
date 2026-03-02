/**
 * GET/PATCH /api/gamification/bossfight/admin
 *
 * Admin-only endpoint for reading/updating boss configuration.
 * GET: Returns current threshold and cooldown settings.
 * PATCH: Updates threshold and/or cooldown.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/rbac";
import { getSettingTyped } from "@/lib/settings/service";
import { updateSetting } from "@/lib/settings/service";
import {
  DEFAULT_BOSS_THRESHOLD,
  DEFAULT_BOSS_COOLDOWN_HOURS,
} from "@/lib/gamification/boss-constants";

const patchSchema = z.object({
  threshold: z.number().min(5).max(200).optional(),
  cooldownHours: z.number().min(1).max(168).optional(),
});

export async function GET() {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  const [threshold, cooldownHours] = await Promise.all([
    getSettingTyped<number>("gamification.boss.threshold", DEFAULT_BOSS_THRESHOLD),
    getSettingTyped<number>("gamification.boss.cooldownHours", DEFAULT_BOSS_COOLDOWN_HOURS),
  ]);

  return NextResponse.json({ threshold, cooldownHours });
}

export async function PATCH(request: NextRequest) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Update each provided field
  if (parsed.data.threshold !== undefined) {
    await updateSetting("gamification.boss.threshold", String(parsed.data.threshold));
  }
  if (parsed.data.cooldownHours !== undefined) {
    await updateSetting("gamification.boss.cooldownHours", String(parsed.data.cooldownHours));
  }

  // Return updated values
  const [threshold, cooldownHours] = await Promise.all([
    getSettingTyped<number>("gamification.boss.threshold", DEFAULT_BOSS_THRESHOLD),
    getSettingTyped<number>("gamification.boss.cooldownHours", DEFAULT_BOSS_COOLDOWN_HOURS),
  ]);

  return NextResponse.json({ threshold, cooldownHours });
}
