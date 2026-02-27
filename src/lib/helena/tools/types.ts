/**
 * Shared types for all Helena tools.
 *
 * ToolContext is injected into every tool factory function,
 * providing shared dependencies (Prisma, user info, RBAC filter).
 */

import type { UserRole } from "@prisma/client";
import type { ExtendedPrismaClient } from "@/lib/db";
import type { ToolCache } from "../tool-cache";

// Re-export tool type from AI SDK for convenience
export type { CoreTool as HelenaTool } from "ai";

export interface ToolContext {
  prisma: ExtendedPrismaClient;
  userId: string;
  userRole: UserRole;
  akteId: string | null;
  /** Pre-computed Prisma WHERE fragment for RBAC-scoped Akte access */
  akteAccessFilter: Record<string, unknown>;
  /** Helena system user ID for audit */
  helenaUserId: string;
  /** In-run cache instance */
  cache: ToolCache;
  /** For cooperative cancellation */
  abortSignal?: AbortSignal;
}

export interface ToolResult<T = unknown> {
  data?: T;
  error?: string;
  source?: SourceAttribution;
}

export interface SourceAttribution {
  table: string;
  id?: string;
  query?: string;
  chunkIds?: string[];
}
