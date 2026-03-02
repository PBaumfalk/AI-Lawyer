import { describe, it, expect } from "vitest";
import {
  getRequiredXp,
  getLevelForXp,
  getLevelTitle,
  getStreakMultiplier,
} from "../game-profile-service";

describe("getRequiredXp", () => {
  it("level 1 requires 0 XP", () => {
    expect(getRequiredXp(1)).toBe(0);
  });

  it("level 2 requires 300 XP (first tier: 300 per level)", () => {
    expect(getRequiredXp(2)).toBe(300);
  });

  it("level 3 requires 600 XP", () => {
    expect(getRequiredXp(3)).toBe(600);
  });

  it("level 10 requires 2700 XP (9 levels * 300)", () => {
    expect(getRequiredXp(10)).toBe(2700);
  });

  it("level 11 requires 3000 XP (2700 + 300 for last level of tier 1)", () => {
    expect(getRequiredXp(11)).toBe(3000);
  });

  it("level 12 requires 3500 XP (3000 + 500 for first level of tier 2)", () => {
    expect(getRequiredXp(12)).toBe(3500);
  });

  it("level 20 requires 7000 XP", () => {
    // L1-10: 9 levels * 300 = 2700. But L11 starts at level 11.
    // Actually: levels 2-10 = 9 levels * 300 = 2700 to reach L10
    // Level 10->11: one more level at 300 = 3000
    // Wait, let me recalculate:
    // Tier 1: levels 1-10, xpPerLevel=300. Levels in this tier for reaching level N:
    //   Levels 2 through min(N, 10+1) exclusive...
    // getRequiredXp(11) = 3000 (given in plan)
    // Tier 2: levels 11-20, xpPerLevel=500
    // getRequiredXp(20) = 3000 + (20-11)*500 = 3000 + 4500 = 7500
    // Wait, level 11 needs 3000. From 11 to 20 there are 9 more levels at 500 each = 4500.
    // getRequiredXp(20) = 3000 + 9*500 = 7500
    // Hmm, but the plan says L21 requires 8000.
    // L11-20: 10 levels * 500 = 5000. 3000+5000=8000 for L21.
    // So from L11 to L20, that's levels 12,13,...,20 = 9 transitions, but L11 itself is the
    // transition from L10 to L11. So from L11 threshold (3000) to L21:
    // 10 levels * 500 = 5000 -> L21 = 8000
    // So L20 = 8000 - 500 = 7500
    expect(getRequiredXp(20)).toBe(7500);
  });

  it("level 21 requires 8000 XP", () => {
    expect(getRequiredXp(21)).toBe(8000);
  });

  it("level 22 requires 8800 XP (tier 3: 800 per level)", () => {
    expect(getRequiredXp(22)).toBe(8800);
  });

  it("level 0 or negative returns 0", () => {
    expect(getRequiredXp(0)).toBe(0);
    expect(getRequiredXp(-1)).toBe(0);
  });
});

describe("getLevelForXp", () => {
  it("0 XP = level 1", () => {
    expect(getLevelForXp(0)).toBe(1);
  });

  it("299 XP = level 1 (not enough for level 2)", () => {
    expect(getLevelForXp(299)).toBe(1);
  });

  it("300 XP = level 2", () => {
    expect(getLevelForXp(300)).toBe(2);
  });

  it("599 XP = level 2", () => {
    expect(getLevelForXp(599)).toBe(2);
  });

  it("600 XP = level 3", () => {
    expect(getLevelForXp(600)).toBe(3);
  });

  it("3000 XP = level 11", () => {
    expect(getLevelForXp(3000)).toBe(11);
  });

  it("8000 XP = level 21", () => {
    expect(getLevelForXp(8000)).toBe(21);
  });

  it("caps at level 50", () => {
    expect(getLevelForXp(999999)).toBe(50);
  });
});

describe("getLevelTitle", () => {
  it("level 1 = Junior Workflow", () => {
    expect(getLevelTitle(1)).toBe("Junior Workflow");
  });

  it("level 10 = Junior Workflow", () => {
    expect(getLevelTitle(10)).toBe("Junior Workflow");
  });

  it("level 11 = Workflow Stabil", () => {
    expect(getLevelTitle(11)).toBe("Workflow Stabil");
  });

  it("level 15 = Workflow Stabil", () => {
    expect(getLevelTitle(15)).toBe("Workflow Stabil");
  });

  it("level 25 = Backlog Controller", () => {
    expect(getLevelTitle(25)).toBe("Backlog Controller");
  });

  it("level 35 = Billing Driver", () => {
    expect(getLevelTitle(35)).toBe("Billing Driver");
  });

  it("level 50 = Kanzlei-Operator", () => {
    expect(getLevelTitle(50)).toBe("Kanzlei-Operator");
  });
});

describe("getStreakMultiplier", () => {
  it("0 days = 1.0 (no bonus)", () => {
    expect(getStreakMultiplier(0)).toBe(1.0);
  });

  it("2 days = 1.0 (below threshold)", () => {
    expect(getStreakMultiplier(2)).toBe(1.0);
  });

  it("3 days = 1.10 (+10%)", () => {
    expect(getStreakMultiplier(3)).toBe(1.1);
  });

  it("6 days = 1.10 (still in 3-day tier)", () => {
    expect(getStreakMultiplier(6)).toBe(1.1);
  });

  it("7 days = 1.25 (+25%)", () => {
    expect(getStreakMultiplier(7)).toBe(1.25);
  });

  it("30 days = 1.25 (capped at highest tier)", () => {
    expect(getStreakMultiplier(30)).toBe(1.25);
  });
});
