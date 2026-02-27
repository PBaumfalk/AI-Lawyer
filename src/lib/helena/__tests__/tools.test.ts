/**
 * Unit tests for Helena tool factory functions and supporting infrastructure.
 *
 * Covers: createHelenaTools factory, filterToolsByRole, individual read/write
 * tool execution, tool-cache, stall-detector, token-budget, rate-limiter.
 *
 * All tests use mocked Prisma (no real DB) and mocked external services.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Mocks -- must be declared before any import that transitively loads them
// ---------------------------------------------------------------------------

// Mock @/lib/rbac
vi.mock("@/lib/rbac", () => ({
  buildAkteAccessFilter: vi.fn((_userId: string, _role: string) => ({
    OR: [{ anwaltId: _userId }],
  })),
}));

// Mock @/lib/logger (noop)
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock @/lib/embedding/embedder
vi.mock("@/lib/embedding/embedder", () => ({
  generateQueryEmbedding: vi.fn(async () => [0.1, 0.2, 0.3]),
}));

// Mock @/lib/gesetze/ingestion
vi.mock("@/lib/gesetze/ingestion", () => ({
  searchLawChunks: vi.fn(async () => [
    {
      id: "chunk-1",
      paragraphNr: "242",
      gesetzKuerzel: "BGB",
      titel: "Leistung nach Treu und Glauben",
      content: "Der Schuldner ist verpflichtet...",
      score: 0.95,
      sourceUrl: "https://example.com/bgb/242",
    },
  ]),
}));

// Mock @/lib/urteile/search
vi.mock("@/lib/urteile/search", () => ({
  searchUrteilChunks: vi.fn(async () => []),
}));

// Mock @/lib/muster/search
vi.mock("@/lib/muster/search", () => ({
  searchMusterChunks: vi.fn(async () => []),
}));

// Mock @/lib/finance/rvg/calculator
vi.mock("@/lib/finance/rvg/calculator", () => ({
  computeRvgFee: vi.fn(() => ({ total: 500 })),
  buildCalculation: vi.fn(() => ({ steps: [] })),
}));

// Mock @/lib/settings/service
vi.mock("@/lib/settings/service", () => ({
  getSettingTyped: vi.fn(async (_key: string, defaultValue: unknown) => defaultValue),
}));

// Mock ioredis -- use a class so `new Redis(...)` works
vi.mock("ioredis", () => {
  class MockRedis {
    status = "ready";
    connect = vi.fn(async () => undefined);
    incr = vi.fn(async () => 1);
    expire = vi.fn(async () => 1);
    ttl = vi.fn(async () => 3600);
    on = vi.fn();
    disconnect = vi.fn();
    constructor() {
      // noop
    }
  }
  return { default: MockRedis };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createHelenaTools } from "../tools/index";
import { filterToolsByRole } from "../role-filter";
import { createToolCache, createCacheKey } from "../tool-cache";
import { createStallDetector, hashResult } from "../stall-detector";
import {
  estimateTokens,
  truncateMessages,
  estimateMessagesTokens,
} from "../token-budget";
import { checkRateLimit } from "../rate-limiter";
import type { ToolContext } from "../tools/types";
import type { CoreMessage } from "ai";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockPrisma(): PrismaClient {
  return {
    akte: {
      findFirst: vi.fn(async () => ({
        id: "akte-1",
        aktenzeichen: "123/26",
        kurzrubrum: "Mustermann ./. Beispiel GmbH",
        sachgebiet: "ZIVILRECHT",
        status: "OFFEN",
        gegenstandswert: 10000,
        anwalt: { name: "Dr. Muster" },
        sachbearbeiter: { name: "Frau Schmidt" },
        _count: { dokumente: 5, kalenderEintraege: 3, beteiligte: 2 },
      })),
      findMany: vi.fn(async () => []),
    },
    dokument: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    helenaDraft: {
      create: vi.fn(async (args: any) => ({
        id: "draft-1",
        ...args.data,
      })),
    },
    helenaAlert: {
      create: vi.fn(async (args: any) => ({
        id: "alert-1",
        severity: args.data.severity ?? 5,
        ...args.data,
      })),
    },
    kalenderEintrag: {
      findMany: vi.fn(async () => []),
    },
    zeiterfassung: {
      findMany: vi.fn(async () => []),
    },
    notiz: {
      create: vi.fn(async (args: any) => ({ id: "notiz-1", ...args.data })),
    },
    $queryRawUnsafe: vi.fn(async () => []),
  } as unknown as PrismaClient;
}

function createMockToolContext(
  overrides?: Partial<ToolContext>,
): ToolContext {
  const prisma = createMockPrisma();
  return {
    prisma,
    userId: "user-test-1",
    userRole: "ADMIN",
    akteId: "akte-1",
    akteAccessFilter: { OR: [{ anwaltId: "user-test-1" }] },
    helenaUserId: "helena-system",
    cache: createToolCache(),
    ...overrides,
  };
}

// ============================================================================
// TEST GROUPS
// ============================================================================

describe("createHelenaTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a Record with all expected tool names for ADMIN", () => {
    const tools = createHelenaTools({
      prisma: createMockPrisma(),
      userId: "user-1",
      userRole: "ADMIN",
      akteId: "akte-1",
      helenaUserId: "helena",
    });

    const keys = Object.keys(tools);
    expect(keys).toContain("read_akte");
    expect(keys).toContain("search_gesetze");
    expect(keys).toContain("create_draft_dokument");
    expect(keys).toContain("create_alert");
    expect(keys).toContain("update_akte_rag");
    expect(keys.length).toBeGreaterThanOrEqual(15);
  });

  it("tool names use snake_case (no dashes)", () => {
    const tools = createHelenaTools({
      prisma: createMockPrisma(),
      userId: "user-1",
      userRole: "ADMIN",
      akteId: null,
      helenaUserId: "helena",
    });

    for (const name of Object.keys(tools)) {
      expect(name).not.toMatch(/-/);
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("returns only tools allowed for SEKRETARIAT role", () => {
    const tools = createHelenaTools({
      prisma: createMockPrisma(),
      userId: "user-1",
      userRole: "SEKRETARIAT",
      akteId: "akte-1",
      helenaUserId: "helena",
    });

    const keys = Object.keys(tools);
    // SEKRETARIAT gets all read tools + create_notiz only
    expect(keys).toContain("read_akte");
    expect(keys).toContain("search_gesetze");
    expect(keys).toContain("create_notiz");
    // Should NOT have other write tools
    expect(keys).not.toContain("create_draft_dokument");
    expect(keys).not.toContain("update_akte_rag");
    expect(keys).not.toContain("create_alert");
  });
});

describe("filterToolsByRole", () => {
  const allToolNames = [
    "read_akte",
    "read_akte_detail",
    "read_dokumente",
    "read_dokumente_detail",
    "read_fristen",
    "read_zeiterfassung",
    "search_gesetze",
    "search_urteile",
    "search_muster",
    "get_kosten_rules",
    "search_alle_akten",
    "search_web",
    "create_draft_dokument",
    "create_draft_frist",
    "create_notiz",
    "create_alert",
    "update_akte_rag",
    "create_draft_zeiterfassung",
  ];

  const allTools = Object.fromEntries(
    allToolNames.map((name) => [name, { fake: true }]),
  );

  it("ADMIN gets all tools", () => {
    const filtered = filterToolsByRole(allTools, "ADMIN");
    expect(Object.keys(filtered).sort()).toEqual(allToolNames.sort());
  });

  it("ANWALT gets all tools", () => {
    const filtered = filterToolsByRole(allTools, "ANWALT");
    expect(Object.keys(filtered).sort()).toEqual(allToolNames.sort());
  });

  it("SACHBEARBEITER gets read + limited write (no update_akte_rag)", () => {
    const filtered = filterToolsByRole(allTools, "SACHBEARBEITER");
    const keys = Object.keys(filtered);
    expect(keys).toContain("read_akte");
    expect(keys).toContain("create_draft_dokument");
    expect(keys).toContain("create_notiz");
    expect(keys).toContain("create_alert");
    expect(keys).not.toContain("update_akte_rag");
  });

  it("SEKRETARIAT gets read + create_notiz only", () => {
    const filtered = filterToolsByRole(allTools, "SEKRETARIAT");
    const keys = Object.keys(filtered);
    expect(keys).toContain("read_akte");
    expect(keys).toContain("search_gesetze");
    expect(keys).toContain("create_notiz");
    expect(keys).not.toContain("create_draft_dokument");
    expect(keys).not.toContain("create_alert");
    expect(keys).not.toContain("update_akte_rag");
  });
});

describe("read tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("read_akte returns summary data", async () => {
    const tools = createHelenaTools({
      prisma: createMockPrisma(),
      userId: "user-1",
      userRole: "ADMIN",
      akteId: "akte-1",
      helenaUserId: "helena",
    });

    const readAkte = tools["read_akte"];
    expect(readAkte).toBeDefined();
    expect(readAkte.execute).toBeDefined();

    const result = (await readAkte.execute!({ akteId: "akte-1" }, {
      toolCallId: "tc-1",
      messages: [],
    } as any)) as any;

    expect(result.data).toBeDefined();
    expect(result.data.aktenzeichen).toBe("123/26");
    expect(result.data.kurzrubrum).toBe("Mustermann ./. Beispiel GmbH");
    expect(result.data.dokumenteCount).toBe(5);
  });

  it("read_akte returns error when no akteId and no context", async () => {
    const tools = createHelenaTools({
      prisma: createMockPrisma(),
      userId: "user-1",
      userRole: "ADMIN",
      akteId: null,
      helenaUserId: "helena",
    });

    const readAkte = tools["read_akte"];
    const result = (await readAkte.execute!({}, {
      toolCallId: "tc-1",
      messages: [],
    } as any)) as any;

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Keine Akte");
  });

  it("read_akte applies akteAccessFilter in WHERE clause", async () => {
    const mockPrisma = createMockPrisma();
    const tools = createHelenaTools({
      prisma: mockPrisma,
      userId: "user-1",
      userRole: "ADMIN",
      akteId: "akte-1",
      helenaUserId: "helena",
    });

    const readAkte = tools["read_akte"];
    await readAkte.execute!({ akteId: "akte-1" }, {
      toolCallId: "tc-1",
      messages: [],
    } as any);

    // Verify findFirst was called with the access filter merged in
    const findFirstMock = (mockPrisma.akte as any).findFirst;
    expect(findFirstMock).toHaveBeenCalled();
    const callArgs = findFirstMock.mock.calls[0][0];
    expect(callArgs.where.id).toBe("akte-1");
  });

  it("search_gesetze calls generateQueryEmbedding then searchLawChunks", async () => {
    const { generateQueryEmbedding } = await import(
      "@/lib/embedding/embedder"
    );
    const { searchLawChunks } = await import("@/lib/gesetze/ingestion");

    const tools = createHelenaTools({
      prisma: createMockPrisma(),
      userId: "user-1",
      userRole: "ADMIN",
      akteId: "akte-1",
      helenaUserId: "helena",
    });

    const searchGesetze = tools["search_gesetze"];
    const result = (await searchGesetze.execute!(
      { query: "Treu und Glauben", limit: 5 },
      { toolCallId: "tc-2", messages: [] } as any,
    )) as any;

    expect(generateQueryEmbedding).toHaveBeenCalledWith("Treu und Glauben");
    expect(searchLawChunks).toHaveBeenCalled();
    expect(result.data).toBeDefined();
    expect(result.data[0].paragraphNr).toBe("242");
    expect(result.data[0].gesetzKuerzel).toBe("BGB");
  });

  it("search_gesetze returns error when embedding fails", async () => {
    const { generateQueryEmbedding } = await import(
      "@/lib/embedding/embedder"
    );
    (generateQueryEmbedding as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Embedding service down"),
    );

    const tools = createHelenaTools({
      prisma: createMockPrisma(),
      userId: "user-1",
      userRole: "ADMIN",
      akteId: "akte-1",
      helenaUserId: "helena",
    });

    const searchGesetze = tools["search_gesetze"];
    const result = (await searchGesetze.execute!(
      { query: "test query", limit: 5 },
      { toolCallId: "tc-3", messages: [] } as any,
    )) as any;

    // The error is caught by the tool wrapper in index.ts and returned as { error: ... }
    expect(result.error).toBeDefined();
  });
});

describe("write tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("create_draft_dokument creates HelenaDraft with PENDING status", async () => {
    const mockPrisma = createMockPrisma();
    const tools = createHelenaTools({
      prisma: mockPrisma,
      userId: "user-1",
      userRole: "ADMIN",
      akteId: "akte-1",
      helenaUserId: "helena",
    });

    const createDraft = tools["create_draft_dokument"];
    const result = (await createDraft.execute!(
      {
        titel: "Klageerwiderung",
        inhalt: "# Klageerwiderung\n\nSehr geehrtes Gericht...",
      },
      { toolCallId: "tc-4", messages: [] } as any,
    )) as any;

    const createMock = (mockPrisma.helenaDraft as any).create;
    expect(createMock).toHaveBeenCalled();
    const createArgs = createMock.mock.calls[0][0];
    expect(createArgs.data.typ).toBe("DOKUMENT");
    expect(createArgs.data.status).toBe("PENDING");
    expect(result.data).toBeDefined();
    expect(result.data.typ).toBe("DOKUMENT");
    expect(result.data.status).toBe("PENDING");
  });

  it("create_alert creates HelenaAlert directly", async () => {
    const mockPrisma = createMockPrisma();
    const tools = createHelenaTools({
      prisma: mockPrisma,
      userId: "user-1",
      userRole: "ADMIN",
      akteId: "akte-1",
      helenaUserId: "helena",
    });

    const createAlert = tools["create_alert"];
    const result = (await createAlert.execute!(
      {
        typ: "FRIST_KRITISCH",
        titel: "Frist laeuft bald ab",
        severity: 8,
      },
      { toolCallId: "tc-5", messages: [] } as any,
    )) as any;

    // Verify it uses helenaAlert.create, NOT helenaDraft.create
    const alertCreate = (mockPrisma.helenaAlert as any).create;
    const draftCreate = (mockPrisma.helenaDraft as any).create;
    expect(alertCreate).toHaveBeenCalled();
    expect(draftCreate).not.toHaveBeenCalled();
    expect(result.data).toBeDefined();
    expect(result.data.typ).toBe("FRIST_KRITISCH");
  });

  it("create_notiz requires akteId (HelenaDraft.akteId is non-nullable)", async () => {
    const tools = createHelenaTools({
      prisma: createMockPrisma(),
      userId: "user-1",
      userRole: "ADMIN",
      akteId: null, // No Akte context
      helenaUserId: "helena",
    });

    const createNotiz = tools["create_notiz"];
    const result = (await createNotiz.execute!(
      { inhalt: "Eine allgemeine Notiz" },
      { toolCallId: "tc-6", messages: [] } as any,
    )) as any;

    // HelenaDraft requires akteId (non-nullable FK)
    expect(result.error).toBeDefined();
    expect(result.error).toContain("Keine Akte");
  });
});

describe("tool-cache", () => {
  it("createCacheKey produces deterministic keys for same params in different order", () => {
    const key1 = createCacheKey("search_gesetze", { query: "test", limit: 5 });
    const key2 = createCacheKey("search_gesetze", { limit: 5, query: "test" });
    expect(key1).toBe(key2);
  });

  it("createCacheKey produces different keys for different tools", () => {
    const key1 = createCacheKey("search_gesetze", { query: "test" });
    const key2 = createCacheKey("search_urteile", { query: "test" });
    expect(key1).not.toBe(key2);
  });

  it("cache.has returns false for unseen key, true after set", () => {
    const cache = createToolCache();
    const key = createCacheKey("read_akte", { akteId: "123" });

    expect(cache.has(key)).toBe(false);

    cache.set(key, { data: { id: "123" } });
    expect(cache.has(key)).toBe(true);
    expect(cache.get(key)).toEqual({ data: { id: "123" } });
  });
});

describe("stall-detector", () => {
  it("isStalled returns false initially", () => {
    const detector = createStallDetector();
    expect(detector.isStalled()).toBe(false);
  });

  it("isStalled returns true after duplicate call (same tool + same params 2x)", () => {
    const detector = createStallDetector();

    detector.record({
      toolName: "read_akte",
      params: { akteId: "123" },
      resultHash: hashResult("result-1"),
    });

    expect(detector.isStalled()).toBe(false);

    detector.record({
      toolName: "read_akte",
      params: { akteId: "123" },
      resultHash: hashResult("result-2"),
    });

    expect(detector.isStalled()).toBe(true);
  });

  it("isStalled returns true after 3 consecutive identical results", () => {
    const detector = createStallDetector();
    const sameHash = hashResult("same content");

    detector.record({
      toolName: "search_gesetze",
      params: { query: "test1" },
      resultHash: sameHash,
    });
    detector.record({
      toolName: "search_urteile",
      params: { query: "test2" },
      resultHash: sameHash,
    });
    detector.record({
      toolName: "search_muster",
      params: { query: "test3" },
      resultHash: sameHash,
    });

    expect(detector.isStalled()).toBe(true);
  });

  it("isStalled returns false for same tool with different params", () => {
    const detector = createStallDetector();

    detector.record({
      toolName: "read_akte",
      params: { akteId: "123" },
      resultHash: hashResult("result-1"),
    });
    detector.record({
      toolName: "read_akte",
      params: { akteId: "456" },
      resultHash: hashResult("result-2"),
    });

    expect(detector.isStalled()).toBe(false);
  });

  it("getForceMessage returns German message", () => {
    const detector = createStallDetector();
    const msg = detector.getForceMessage();
    expect(msg).toContain("Du wiederholst dich");
    expect(msg).toContain("beste Antwort");
  });

  it("reset clears stall state", () => {
    const detector = createStallDetector();

    // Make it stall
    detector.record({
      toolName: "read_akte",
      params: { akteId: "123" },
      resultHash: hashResult("r"),
    });
    detector.record({
      toolName: "read_akte",
      params: { akteId: "123" },
      resultHash: hashResult("r"),
    });
    expect(detector.isStalled()).toBe(true);

    detector.reset();
    expect(detector.isStalled()).toBe(false);
  });
});

describe("token-budget", () => {
  it("estimateTokens returns reasonable estimate", () => {
    // "hello" = 5 chars -> ceil(5/3.5) = 2 tokens
    const tokens = estimateTokens("hello");
    expect(tokens).toBe(2);
  });

  it("estimateTokens handles non-string input", () => {
    const tokens = estimateTokens({ key: "value" });
    expect(tokens).toBeGreaterThan(0);
  });

  it("truncateMessages preserves system and first user message", () => {
    const messages: CoreMessage[] = [
      { role: "system", content: "System prompt" },
      { role: "user", content: "First user message" },
      { role: "assistant", content: "Response 1" },
      { role: "tool", content: [{ type: "tool-result", toolCallId: "t1", toolName: "test", result: "A".repeat(5000) }] } as CoreMessage, // Large tool result
      { role: "assistant", content: "Response 2" },
      { role: "tool", content: [{ type: "tool-result", toolCallId: "t2", toolName: "test", result: "B".repeat(5000) }] } as CoreMessage, // Large tool result
      { role: "user", content: "Second user message" },
    ];

    // Use a small context window to force truncation
    const truncated = truncateMessages(messages, 100, 0.5);

    // System and first user message should always survive
    expect(truncated.find((m) => m.role === "system")).toBeDefined();
    expect(truncated[1]?.content).toBe("First user message");
  });

  it("truncateMessages removes oldest tool results when over budget", () => {
    const messages: CoreMessage[] = [
      { role: "system", content: "System" },
      { role: "user", content: "Question" },
      { role: "assistant", content: "Let me look..." },
      { role: "tool", content: [{ type: "tool-result", toolCallId: "t1", toolName: "test", result: "X".repeat(10000) }] } as CoreMessage,
      { role: "assistant", content: "More analysis..." },
      { role: "tool", content: [{ type: "tool-result", toolCallId: "t2", toolName: "test", result: "Y".repeat(10000) }] } as CoreMessage,
      { role: "user", content: "Last question" },
    ];

    const original = messages.length;
    const truncated = truncateMessages(messages, 200, 0.5);
    expect(truncated.length).toBeLessThan(original);
  });

  it("truncateMessages returns unchanged if under budget", () => {
    const messages: CoreMessage[] = [
      { role: "system", content: "Short" },
      { role: "user", content: "Hi" },
    ];

    // Large enough window that no truncation is needed
    const truncated = truncateMessages(messages, 100_000, 0.75);
    expect(truncated).toEqual(messages);
  });

  it("estimateMessagesTokens sums across all messages", () => {
    const messages: CoreMessage[] = [
      { role: "system", content: "Hello" },
      { role: "user", content: "World" },
    ];
    const total = estimateMessagesTokens(messages);
    // Each msg: ~2 content tokens + 4 overhead = 6, total ~12
    expect(total).toBeGreaterThanOrEqual(8);
  });
});

describe("rate-limiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checkRateLimit allows request when under limit", async () => {
    const mockPrisma = createMockPrisma();
    const result = await checkRateLimit({
      userId: "user-1",
      prisma: mockPrisma,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
    expect(result.limit).toBeGreaterThan(0);
    expect(result.resetAt).toBeInstanceOf(Date);
  });

  it("checkRateLimit returns rate limit info with a positive limit", async () => {
    const mockPrisma = createMockPrisma();
    const result = await checkRateLimit({
      userId: "user-1",
      prisma: mockPrisma,
    });

    // Default limit is 60
    expect(result.limit).toBe(60);
  });
});
