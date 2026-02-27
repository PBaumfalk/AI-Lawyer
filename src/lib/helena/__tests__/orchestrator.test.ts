/**
 * Integration tests for Helena ReAct loop (orchestrator) with mock LLM.
 *
 * Covers: runAgent basic flow, stall detection, token budget truncation,
 * error handling (timeout/abort/error), step updates, and the public
 * runHelenaAgent entry point with rate limiting and complexity classification.
 *
 * All tests use mocked AI SDK generateText, no real LLM calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/db";

// ---------------------------------------------------------------------------
// Mocks -- declared before imports
// ---------------------------------------------------------------------------

// Mock @/lib/logger (noop)
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock audit logger
vi.mock("@/lib/helena/audit-logger", () => ({
  logToolCall: vi.fn(),
}));

// Mock token tracker
vi.mock("@/lib/ai/token-tracker", () => ({
  trackTokenUsage: vi.fn(async () => undefined),
}));

// Track whether generateText mock calls onStepFinish
let generateTextMockImpl: ((...args: any[]) => any) | null = null;

// Mock AI SDK generateText
vi.mock("ai", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    generateText: vi.fn(async (opts: any) => {
      if (generateTextMockImpl) {
        return generateTextMockImpl(opts);
      }
      // Default: simple text response
      if (opts.onStepFinish) {
        await opts.onStepFinish({
          text: "Hier ist meine Antwort.",
          toolCalls: [],
          toolResults: [],
          usage: { promptTokens: 100, completionTokens: 50 },
          finishReason: "stop",
        });
      }
      return {
        text: "Hier ist meine Antwort.",
        steps: [
          {
            text: "Hier ist meine Antwort.",
            toolCalls: [],
            toolResults: [],
            usage: { promptTokens: 100, completionTokens: 50 },
            finishReason: "stop",
          },
        ],
        usage: { promptTokens: 100, completionTokens: 50 },
        finishReason: "stop",
      };
    }),
  };
});

// Mock @/lib/rbac
vi.mock("@/lib/rbac", () => ({
  buildAkteAccessFilter: vi.fn(() => ({})),
}));

// Mock @/lib/settings/service
vi.mock("@/lib/settings/service", () => ({
  getSettingTyped: vi.fn(async (_key: string, defaultValue: unknown) => defaultValue),
}));

// Mock @/lib/ai/provider
vi.mock("@/lib/ai/provider", () => ({
  getModel: vi.fn(async () => ({ /* mock model */ })),
  getProviderName: vi.fn(async () => "ollama"),
  getModelName: vi.fn(async () => "qwen3.5:35b"),
  getHelenaUserId: vi.fn(async () => "helena-system-id"),
  DEFAULT_MODELS: { ollama: "qwen3.5:35b", openai: "gpt-4o", anthropic: "claude-sonnet-4-20250514" },
}));

// Mock embedding/search (needed by tools)
vi.mock("@/lib/embedding/embedder", () => ({
  generateQueryEmbedding: vi.fn(async () => [0.1, 0.2, 0.3]),
}));
vi.mock("@/lib/gesetze/ingestion", () => ({
  searchLawChunks: vi.fn(async () => []),
}));
vi.mock("@/lib/urteile/search", () => ({
  searchUrteilChunks: vi.fn(async () => []),
}));
vi.mock("@/lib/muster/search", () => ({
  searchMusterChunks: vi.fn(async () => []),
}));
vi.mock("@/lib/finance/rvg/calculator", () => ({
  computeRvgFee: vi.fn(() => ({ total: 500 })),
  buildCalculation: vi.fn(() => ({ steps: [] })),
}));

// Mock ioredis
vi.mock("ioredis", () => {
  class MockRedis {
    status = "ready";
    connect = vi.fn(async () => undefined);
    incr = vi.fn(async () => 1);
    expire = vi.fn(async () => 1);
    ttl = vi.fn(async () => 3600);
    on = vi.fn();
    disconnect = vi.fn();
  }
  return { default: MockRedis };
});

// Mock complexity classifier
vi.mock("@/lib/helena/complexity-classifier", () => ({
  classifyComplexity: vi.fn(() => ({
    mode: "inline",
    tier: 2 as 1 | 2 | 3,
    reason: "Standard",
  })),
  getModelForTier: vi.fn(async (tier: number) => ({
    model: {},
    modelName: tier === 3 ? "claude-sonnet-4-20250514" : "qwen3.5:35b",
  })),
  escalateTier: vi.fn((t: number) => Math.min(t + 1, 3)),
}));

// Mock rate limiter
vi.mock("@/lib/helena/rate-limiter", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 59,
    limit: 60,
    resetAt: new Date(Date.now() + 3600000),
  })),
}));

// Mock response guard
vi.mock("@/lib/helena/response-guard", () => ({
  ollamaResponseGuard: vi.fn(async () => null),
  contentScanGuard: vi.fn(() => ({ detected: false })),
}));

// Mock system prompt
vi.mock("@/lib/helena/system-prompt", () => ({
  buildSystemPrompt: vi.fn(() => "Du bist Helena, die KI-Assistentin."),
}));

// Mock tools factory
vi.mock("@/lib/helena/tools", () => ({
  createHelenaTools: vi.fn(() => ({
    read_akte: {
      description: "Read akte",
      parameters: { type: "object" as const, properties: {} },
      execute: vi.fn(async () => ({
        data: { id: "akte-1", aktenzeichen: "123/26" },
      })),
    },
  })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { runAgent, type AgentRunOptions } from "../orchestrator";
import { generateText } from "ai";
import type { CoreMessage } from "ai";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createBaseOptions(
  overrides?: Partial<AgentRunOptions>,
): AgentRunOptions {
  return {
    model: {} as any,
    modelName: "qwen3.5:35b",
    tools: {
      read_akte: {
        description: "Read akte summary",
        parameters: { type: "object" as const, properties: {} },
        execute: vi.fn(async () => ({
          data: { id: "akte-1", aktenzeichen: "123/26" },
        })),
      } as any,
    },
    systemPrompt: "Du bist Helena.",
    messages: [{ role: "user" as const, content: "Was ist die Akte?" }],
    mode: "inline",
    userId: "user-1",
    akteId: "akte-1",
    ...overrides,
  };
}

// ============================================================================
// TEST GROUPS
// ============================================================================

describe("runAgent - basic flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateTextMockImpl = null;
  });

  it("completes with text response when LLM returns stop", async () => {
    generateTextMockImpl = async (opts: any) => {
      if (opts.onStepFinish) {
        await opts.onStepFinish({
          text: "Hier ist die Akte 123/26.",
          toolCalls: [],
          toolResults: [],
          usage: { promptTokens: 80, completionTokens: 40 },
          finishReason: "stop",
        });
      }
      return {
        text: "Hier ist die Akte 123/26.",
        steps: [],
        usage: { promptTokens: 80, completionTokens: 40 },
        finishReason: "stop",
      };
    };

    const result = await runAgent(createBaseOptions());

    expect(result.text).toBe("Hier ist die Akte 123/26.");
    expect(result.finishReason).toBe("stop");
    expect(result.stalled).toBe(false);
  });

  it("executes tool call and returns final text", async () => {
    generateTextMockImpl = async (opts: any) => {
      // Step 1: tool call
      if (opts.onStepFinish) {
        await opts.onStepFinish({
          text: "",
          toolCalls: [
            {
              toolCallId: "tc-1",
              toolName: "read_akte",
              args: { akteId: "akte-1" },
            },
          ],
          toolResults: [
            {
              toolCallId: "tc-1",
              toolName: "read_akte",
              result: { data: { id: "akte-1", aktenzeichen: "123/26" } },
            },
          ],
          usage: { promptTokens: 100, completionTokens: 30 },
          finishReason: "tool-calls",
        });

        // Step 2: text response
        await opts.onStepFinish({
          text: "Die Akte 123/26 ist offen.",
          toolCalls: [],
          toolResults: [],
          usage: { promptTokens: 150, completionTokens: 40 },
          finishReason: "stop",
        });
      }

      return {
        text: "Die Akte 123/26 ist offen.",
        steps: [],
        usage: { promptTokens: 250, completionTokens: 70 },
        finishReason: "stop",
      };
    };

    const result = await runAgent(createBaseOptions());

    expect(result.text).toBe("Die Akte 123/26 ist offen.");
    expect(result.steps.some((s) => s.type === "toolCall")).toBe(true);
    expect(result.steps.some((s) => s.type === "toolResult")).toBe(true);
    expect(result.totalTokens.prompt).toBe(250);
    expect(result.totalTokens.completion).toBe(70);
  });

  it("respects maxSteps for inline mode (5)", async () => {
    const opts = createBaseOptions({ mode: "inline" });

    generateTextMockImpl = async (genOpts: any) => {
      // Verify maxSteps was passed as 5
      expect(genOpts.maxSteps).toBe(5);

      if (genOpts.onStepFinish) {
        await genOpts.onStepFinish({
          text: "OK",
          toolCalls: [],
          toolResults: [],
          usage: { promptTokens: 50, completionTokens: 20 },
          finishReason: "stop",
        });
      }
      return {
        text: "OK",
        steps: [],
        usage: { promptTokens: 50, completionTokens: 20 },
        finishReason: "stop",
      };
    };

    await runAgent(opts);
  });

  it("respects maxSteps for background mode (20)", async () => {
    const opts = createBaseOptions({ mode: "background" });

    generateTextMockImpl = async (genOpts: any) => {
      // Verify maxSteps was passed as 20
      expect(genOpts.maxSteps).toBe(20);

      if (genOpts.onStepFinish) {
        await genOpts.onStepFinish({
          text: "OK",
          toolCalls: [],
          toolResults: [],
          usage: { promptTokens: 50, completionTokens: 20 },
          finishReason: "stop",
        });
      }
      return {
        text: "OK",
        steps: [],
        usage: { promptTokens: 50, completionTokens: 20 },
        finishReason: "stop",
      };
    };

    await runAgent(opts);
  });
});

describe("runAgent - stall detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateTextMockImpl = null;
  });

  it("detects stall when same tool called with same params twice", async () => {
    generateTextMockImpl = async (opts: any) => {
      if (opts.onStepFinish) {
        // Same tool + same params twice -> stall detected after 2nd call
        await opts.onStepFinish({
          text: "",
          toolCalls: [
            {
              toolCallId: "tc-1",
              toolName: "read_akte",
              args: { akteId: "akte-1" },
            },
          ],
          toolResults: [
            {
              toolCallId: "tc-1",
              toolName: "read_akte",
              result: { data: { id: "akte-1" } },
            },
          ],
          usage: { promptTokens: 100, completionTokens: 30 },
          finishReason: "tool-calls",
        });

        await opts.onStepFinish({
          text: "",
          toolCalls: [
            {
              toolCallId: "tc-2",
              toolName: "read_akte",
              args: { akteId: "akte-1" },
            },
          ],
          toolResults: [
            {
              toolCallId: "tc-2",
              toolName: "read_akte",
              result: { data: { id: "akte-1" } },
            },
          ],
          usage: { promptTokens: 100, completionTokens: 30 },
          finishReason: "tool-calls",
        });

        // Final text after force message injection
        await opts.onStepFinish({
          text: "Hier ist die Zusammenfassung.",
          toolCalls: [],
          toolResults: [],
          usage: { promptTokens: 200, completionTokens: 50 },
          finishReason: "stop",
        });
      }
      return {
        text: "Hier ist die Zusammenfassung.",
        steps: [],
        usage: { promptTokens: 400, completionTokens: 110 },
        finishReason: "stop",
      };
    };

    const result = await runAgent(createBaseOptions());
    expect(result.stalled).toBe(true);
    expect(result.finishReason).toBe("stall");
  });

  it("injects force message when stall detected", async () => {
    let injectedMessages: CoreMessage[] = [];

    generateTextMockImpl = async (opts: any) => {
      injectedMessages = opts.messages;

      if (opts.onStepFinish) {
        // Duplicate calls
        await opts.onStepFinish({
          text: "",
          toolCalls: [
            {
              toolCallId: "tc-1",
              toolName: "read_akte",
              args: { akteId: "akte-1" },
            },
          ],
          toolResults: [
            {
              toolCallId: "tc-1",
              toolName: "read_akte",
              result: "data",
            },
          ],
          usage: { promptTokens: 100, completionTokens: 30 },
          finishReason: "tool-calls",
        });

        await opts.onStepFinish({
          text: "",
          toolCalls: [
            {
              toolCallId: "tc-2",
              toolName: "read_akte",
              args: { akteId: "akte-1" },
            },
          ],
          toolResults: [
            {
              toolCallId: "tc-2",
              toolName: "read_akte",
              result: "data",
            },
          ],
          usage: { promptTokens: 100, completionTokens: 30 },
          finishReason: "tool-calls",
        });
      }

      return {
        text: "Zusammenfassung",
        steps: [],
        usage: { promptTokens: 200, completionTokens: 60 },
        finishReason: "stop",
      };
    };

    await runAgent(createBaseOptions());

    // The force message should have been injected into the working messages
    // which are the same array as opts.messages (mutable copy)
    const forceMsg = injectedMessages.find(
      (m) =>
        m.role === "user" &&
        typeof m.content === "string" &&
        m.content.includes("Du wiederholst dich"),
    );
    expect(forceMsg).toBeDefined();
  });
});

describe("runAgent - token budget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateTextMockImpl = null;
  });

  it("tracks truncation when messages exceed budget", async () => {
    // Create messages whose total tokens exceed 75% of context window (32768).
    // estimateTokens uses ceil(chars/3.5) + 4 per message.
    // We need total > 32768 * 0.75 = 24576 tokens.
    // Each message with 30000 chars = ~8572 tokens + 4 = 8576.
    // 4 messages * 8576 = ~34304 tokens, well above 24576.
    const largeMessages: CoreMessage[] = [
      { role: "system", content: "System prompt" },
      { role: "user", content: "Initial question" },
      { role: "assistant", content: "A".repeat(30000) },
      { role: "tool", content: [{ type: "tool-result", toolCallId: "t1", toolName: "test", result: "B".repeat(30000) }] } as CoreMessage,
      { role: "assistant", content: "C".repeat(30000) },
      { role: "tool", content: [{ type: "tool-result", toolCallId: "t2", toolName: "test", result: "D".repeat(30000) }] } as CoreMessage,
      { role: "user", content: "Follow-up" },
    ];

    generateTextMockImpl = async (opts: any) => {
      if (opts.onStepFinish) {
        await opts.onStepFinish({
          text: "Done",
          toolCalls: [],
          toolResults: [],
          usage: { promptTokens: 1000, completionTokens: 50 },
          finishReason: "stop",
        });
      }
      return {
        text: "Done",
        steps: [],
        usage: { promptTokens: 1000, completionTokens: 50 },
        finishReason: "stop",
      };
    };

    const result = await runAgent(
      createBaseOptions({
        messages: largeMessages,
      }),
    );

    // The large messages should trigger truncation when approaching
    // 75% of qwen3.5 context window (32768)
    expect(result.truncated).toBe(true);
  });
});

describe("runAgent - error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateTextMockImpl = null;
  });

  it("returns timeout finishReason on timeout", async () => {
    generateTextMockImpl = async (opts: any) => {
      // Simulate a slow response by checking if abort signal is set
      // The orchestrator sets a timeout with controller.abort("timeout")
      // We need to simulate an AbortError thrown by generateText
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      throw error;
    };

    // Use a very short implicit timeout by aborting immediately
    const controller = new AbortController();
    // Abort with timeout reason immediately
    setTimeout(() => controller.abort("timeout"), 5);

    const result = await runAgent(
      createBaseOptions({
        abortSignal: controller.signal,
        // The orchestrator has its own timeout; for the test we rely on the
        // mock throwing AbortError to simulate the timeout scenario
      }),
    );

    expect(["timeout", "abort"]).toContain(result.finishReason);
    expect(result.text).toBeDefined();
  });

  it("returns abort finishReason on user cancel", async () => {
    const controller = new AbortController();

    generateTextMockImpl = async (opts: any) => {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      throw error;
    };

    // Pre-abort before calling
    controller.abort("user-cancel");

    const result = await runAgent(
      createBaseOptions({
        abortSignal: controller.signal,
      }),
    );

    expect(result.finishReason).toBe("abort");
    expect(result.text).toContain("abgebrochen");
  });

  it("returns partial result on error", async () => {
    generateTextMockImpl = async (opts: any) => {
      // First complete a step successfully
      if (opts.onStepFinish) {
        await opts.onStepFinish({
          text: "Ich schaue mir die Akte an.",
          toolCalls: [],
          toolResults: [],
          usage: { promptTokens: 50, completionTokens: 20 },
          finishReason: "stop",
        });
      }
      // Then throw an error
      throw new Error("Model provider error");
    };

    const result = await runAgent(createBaseOptions());

    expect(result.finishReason).toBe("error");
    expect(result.steps.length).toBeGreaterThan(0);
    // Should have partial text from the completed step
    expect(result.text).toContain("Fehler");
    // Should have an error step recorded
    expect(result.steps.some((s) => s.type === "error")).toBe(true);
  });
});

describe("runAgent - step updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateTextMockImpl = null;
  });

  it("calls onStepUpdate after each step", async () => {
    const onStepUpdate = vi.fn();

    generateTextMockImpl = async (opts: any) => {
      if (opts.onStepFinish) {
        await opts.onStepFinish({
          text: "Step 1 text",
          toolCalls: [],
          toolResults: [],
          usage: { promptTokens: 50, completionTokens: 20 },
          finishReason: "stop",
        });

        await opts.onStepFinish({
          text: "Step 2 text",
          toolCalls: [],
          toolResults: [],
          usage: { promptTokens: 50, completionTokens: 20 },
          finishReason: "stop",
        });
      }
      return {
        text: "Step 2 text",
        steps: [],
        usage: { promptTokens: 100, completionTokens: 40 },
        finishReason: "stop",
      };
    };

    await runAgent(
      createBaseOptions({
        onStepUpdate,
      }),
    );

    expect(onStepUpdate).toHaveBeenCalledTimes(2);

    // Verify the StepUpdate shape
    const firstCall = onStepUpdate.mock.calls[0][0];
    expect(firstCall).toHaveProperty("stepNumber", 1);
    expect(firstCall).toHaveProperty("maxSteps");
    expect(firstCall).toHaveProperty("toolName");
    expect(firstCall).toHaveProperty("resultSummary");
    expect(firstCall).toHaveProperty("tokenEstimate");

    const secondCall = onStepUpdate.mock.calls[1][0];
    expect(secondCall.stepNumber).toBe(2);
  });
});

describe("runHelenaAgent - integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateTextMockImpl = null;
  });

  // Need a fresh import of the module under test for each test
  // because the mocks are set up at the top
  it("returns rate limit error when rate limited", async () => {
    // Override checkRateLimit to deny
    const { checkRateLimit } = await import("../rate-limiter");
    (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      limit: 60,
      resetAt: new Date(Date.now() + 3600000),
      message: "Du hast das Limit von 60 Helena-Anfragen pro Stunde erreicht.",
    });

    // Import the entry point which uses the mocked modules
    const { runHelenaAgent } = await import("../index");

    const result = await runHelenaAgent({
      prisma: {} as unknown as ExtendedPrismaClient,
      userId: "user-1",
      userRole: "ADMIN",
      userName: "Test User",
      akteId: "akte-1",
      message: "Was ist die Akte?",
    });

    expect(result.rateLimited).toBe(true);
    expect(result.text).toContain("Limit");
    expect(result.finishReason).toBe("rate-limited");
    expect(result.totalTokens.prompt).toBe(0);
    expect(result.totalTokens.completion).toBe(0);
  });

  it("classifies complexity and selects mode in auto mode", async () => {
    const { classifyComplexity } = await import("../complexity-classifier");
    (classifyComplexity as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      mode: "background",
      tier: 2,
      reason: "Entwurfsaufgabe erkannt",
    });

    // Reset rate limiter to allow
    const { checkRateLimit } = await import("../rate-limiter");
    (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: true,
      remaining: 59,
      limit: 60,
      resetAt: new Date(Date.now() + 3600000),
    });

    // Ensure generateText returns properly
    generateTextMockImpl = async (opts: any) => {
      if (opts.onStepFinish) {
        await opts.onStepFinish({
          text: "Entwurf erstellt.",
          toolCalls: [],
          toolResults: [],
          usage: { promptTokens: 100, completionTokens: 50 },
          finishReason: "stop",
        });
      }
      return {
        text: "Entwurf erstellt.",
        steps: [],
        usage: { promptTokens: 100, completionTokens: 50 },
        finishReason: "stop",
      };
    };

    const { runHelenaAgent } = await import("../index");

    const result = await runHelenaAgent({
      prisma: {} as unknown as ExtendedPrismaClient,
      userId: "user-1",
      userRole: "ANWALT",
      userName: "Dr. Muster",
      akteId: "akte-1",
      message: "Erstelle einen Schriftsatz",
      mode: "auto",
    });

    // Should have used background mode from classifier
    expect(result.mode).toBe("background");
  });

  it("uses ollamaResponseGuard for ollama provider", async () => {
    const { getProviderName } = await import("@/lib/ai/provider");
    (getProviderName as ReturnType<typeof vi.fn>).mockResolvedValueOnce("ollama");

    // Reset rate limiter
    const { checkRateLimit } = await import("../rate-limiter");
    (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: true,
      remaining: 59,
      limit: 60,
      resetAt: new Date(Date.now() + 3600000),
    });

    generateTextMockImpl = async (opts: any) => {
      // Verify repairToolCall was passed
      // The runHelenaAgent function checks provider === "ollama"
      // and passes ollamaResponseGuard as repairToolCall
      if (opts.onStepFinish) {
        await opts.onStepFinish({
          text: "OK",
          toolCalls: [],
          toolResults: [],
          usage: { promptTokens: 50, completionTokens: 20 },
          finishReason: "stop",
        });
      }
      return {
        text: "OK",
        steps: [],
        usage: { promptTokens: 50, completionTokens: 20 },
        finishReason: "stop",
      };
    };

    const { runHelenaAgent } = await import("../index");

    const result = await runHelenaAgent({
      prisma: {} as unknown as ExtendedPrismaClient,
      userId: "user-1",
      userRole: "ADMIN",
      userName: "Test",
      akteId: "akte-1",
      message: "Test query",
    });

    // Verify generateText was called with experimental_repairToolCall
    const genTextMock = generateText as ReturnType<typeof vi.fn>;
    const lastCall = genTextMock.mock.calls[genTextMock.mock.calls.length - 1];
    if (lastCall) {
      expect(lastCall[0]).toHaveProperty("experimental_repairToolCall");
    }
  });
});
