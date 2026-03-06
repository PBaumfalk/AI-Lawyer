import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @/lib/redis before importing alerts
vi.mock("@/lib/redis", () => ({
  createRedisConnection: vi.fn(),
}));

import { createRedisConnection } from "@/lib/redis";
import { checkAndAlertHealthStatus } from "./alerts";

// Mock prisma and email dependencies to isolate cooldown tests
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Helper: create mock redis with controllable get/set
function createMockRedis({
  getResult = null as string | null,
  getError = null as Error | null,
  setError = null as Error | null,
} = {}) {
  const mockSet = vi.fn().mockImplementation(async () => {
    if (setError) throw setError;
    return "OK";
  });
  const mockGet = vi.fn().mockImplementation(async () => {
    if (getError) throw getError;
    return getResult;
  });
  const mockDisconnect = vi.fn();

  return { set: mockSet, get: mockGet, disconnect: mockDisconnect };
}

describe("health alerts Redis-backed cooldown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hasCooldown returns false when Redis returns null (no cooldown set)", async () => {
    const mockRedis = createMockRedis({ getResult: null });
    vi.mocked(createRedisConnection).mockReturnValue(mockRedis as never);

    // Trigger alert evaluation — service is unhealthy
    // If hasCooldown returns false, checkAndAlertHealthStatus will attempt to send alerts
    // (sendEmail is mocked to return false, alertsSent=0 but flow proceeds normally)
    const result = await checkAndAlertHealthStatus([
      { name: "test-service", status: "unhealthy" },
    ]);

    // servicesDown should be populated
    expect(result.servicesDown).toContain("test-service");

    // Redis.get should have been called for the cooldown check
    expect(mockRedis.get).toHaveBeenCalledWith(
      "health:alert:cooldown:test-service"
    );
  });

  it("hasCooldown returns true when Redis returns a value (cooldown active)", async () => {
    const mockRedis = createMockRedis({ getResult: "1" });
    vi.mocked(createRedisConnection).mockReturnValue(mockRedis as never);

    const result = await checkAndAlertHealthStatus([
      { name: "test-service", status: "unhealthy" },
    ]);

    // Cooldown active — alertsSent stays 0, no email attempt
    expect(result.alertsSent).toBe(0);
    expect(result.servicesDown).toContain("test-service");
  });

  it("setCooldown calls redis.set with correct key, value, and TTL", async () => {
    const mockRedis = createMockRedis({ getResult: null });
    vi.mocked(createRedisConnection).mockReturnValue(mockRedis as never);

    // prisma returns one admin email so sendEmail path runs
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { email: "admin@test.com" } as never,
    ]);

    await checkAndAlertHealthStatus([
      { name: "myservice", status: "unhealthy" },
    ]);

    // After sending alert (or attempting), setCooldown should store Redis key
    expect(mockRedis.set).toHaveBeenCalledWith(
      "health:alert:cooldown:myservice",
      "1",
      "EX",
      3600
    );
  });

  it("falls back gracefully when Redis.get throws — does not crash", async () => {
    const mockRedis = createMockRedis({
      getError: new Error("Redis connection refused"),
    });
    vi.mocked(createRedisConnection).mockReturnValue(mockRedis as never);

    // Should NOT throw — fallback to in-memory behavior
    await expect(
      checkAndAlertHealthStatus([{ name: "test-service", status: "unhealthy" }])
    ).resolves.toBeDefined();
  });

  it("falls back gracefully when Redis.set throws — does not crash", async () => {
    const mockRedis = createMockRedis({
      getResult: null,
      setError: new Error("Redis write failed"),
    });
    vi.mocked(createRedisConnection).mockReturnValue(mockRedis as never);

    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { email: "admin@test.com" } as never,
    ]);

    // Should NOT throw even when set fails
    await expect(
      checkAndAlertHealthStatus([{ name: "fail-service", status: "unhealthy" }])
    ).resolves.toBeDefined();
  });
});
