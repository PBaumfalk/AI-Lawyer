/**
 * Helena tool factory with static registry.
 *
 * createHelenaTools() builds a ToolContext and instantiates all
 * tool modules, then applies role-based filtering. Each tool's
 * execute function is wrapped with cache checking, audit logging,
 * and error handling.
 *
 * Uses explicit static imports (no dynamic require) to work
 * reliably with esbuild bundling.
 */

import type { PrismaClient, UserRole } from "@prisma/client";
import type { CoreTool } from "ai";
import { buildAkteAccessFilter } from "@/lib/rbac";
import { createToolCache, createCacheKey } from "../tool-cache";
import { logToolCall } from "../audit-logger";
import { filterToolsByRole } from "../role-filter";
import type { ToolContext } from "./types";

// --- Static imports: Read tools ---
import { createReadAkteTool } from "./_read/read-akte";
import { createReadAkteDetailTool } from "./_read/read-akte-detail";
import { createReadDokumenteTool } from "./_read/read-dokumente";
import { createReadDokumenteDetailTool } from "./_read/read-dokumente-detail";
import { createReadFristenTool } from "./_read/read-fristen";
import { createReadZeiterfassungTool } from "./_read/read-zeiterfassung";
import { createSearchGesetzeTool } from "./_read/search-gesetze";
import { createSearchUrteileTool } from "./_read/search-urteile";
import { createSearchMusterTool } from "./_read/search-muster";
import { createGetKostenRulesTool } from "./_read/get-kosten-rules";
import { createSearchAlleAktenTool } from "./_read/search-alle-akten";
import { createSearchWebTool } from "./_read/search-web";

// --- Static imports: Write tools ---
import { createCreateDraftDokumentTool } from "./_write/create-draft-dokument";
import { createCreateDraftFristTool } from "./_write/create-draft-frist";
import { createCreateNotizTool } from "./_write/create-notiz";
import { createCreateAlertTool } from "./_write/create-alert";
import { createUpdateAkteRagTool } from "./_write/update-akte-rag";
import { createCreateDraftZeiterfassungTool } from "./_write/create-draft-zeiterfassung";

// --- Tool registry: filename (snake_case) -> factory function ---
const TOOL_REGISTRY: Record<
  string,
  (ctx: ToolContext) => CoreTool<any, any>
> = {
  // Read tools
  read_akte: createReadAkteTool,
  read_akte_detail: createReadAkteDetailTool,
  read_dokumente: createReadDokumenteTool,
  read_dokumente_detail: createReadDokumenteDetailTool,
  read_fristen: createReadFristenTool,
  read_zeiterfassung: createReadZeiterfassungTool,
  search_gesetze: createSearchGesetzeTool,
  search_urteile: createSearchUrteileTool,
  search_muster: createSearchMusterTool,
  get_kosten_rules: createGetKostenRulesTool,
  search_alle_akten: createSearchAlleAktenTool,
  search_web: createSearchWebTool,
  // Write tools
  create_draft_dokument: createCreateDraftDokumentTool,
  create_draft_frist: createCreateDraftFristTool,
  create_notiz: createCreateNotizTool,
  create_alert: createCreateAlertTool,
  update_akte_rag: createUpdateAkteRagTool,
  create_draft_zeiterfassung: createCreateDraftZeiterfassungTool,
};

export interface CreateHelenaToolsOptions {
  prisma: PrismaClient;
  userId: string;
  userRole: UserRole;
  akteId: string | null;
  helenaUserId: string;
  abortSignal?: AbortSignal;
}

/**
 * Create all Helena tools with shared context and role-based filtering.
 *
 * Each tool's execute is wrapped with:
 * 1. Cache check (dedup identical calls within one run)
 * 2. Audit logging (structured log with truncated result)
 * 3. Error handling (catch all, return ToolResult with error)
 */
export function createHelenaTools(
  options: CreateHelenaToolsOptions,
): Record<string, CoreTool<any, any>> {
  const cache = createToolCache();

  const ctx: ToolContext = {
    prisma: options.prisma,
    userId: options.userId,
    userRole: options.userRole,
    akteId: options.akteId,
    akteAccessFilter: buildAkteAccessFilter(options.userId, options.userRole),
    helenaUserId: options.helenaUserId,
    cache,
    abortSignal: options.abortSignal,
  };

  // Build all tools from registry
  const allTools: Record<string, CoreTool<any, any>> = {};

  for (const [toolName, createFn] of Object.entries(TOOL_REGISTRY)) {
    const baseTool = createFn(ctx);

    // Wrap execute with cache, audit, and error handling
    const originalExecute = baseTool.execute;
    if (originalExecute) {
      const wrappedExecute = async (
        args: unknown,
        execOptions: unknown,
      ): Promise<unknown> => {
        const cacheKey = createCacheKey(
          toolName,
          (args as Record<string, unknown>) ?? {},
        );

        // Cache check
        if (cache.has(cacheKey)) {
          return cache.get(cacheKey);
        }

        const startMs = Date.now();

        try {
          const result = await originalExecute(args, execOptions as any);
          const durationMs = Date.now() - startMs;

          // Cache result
          cache.set(cacheKey, result);

          // Audit log
          logToolCall({
            toolName,
            params: (args as Record<string, unknown>) ?? {},
            resultSummary: JSON.stringify(result).slice(0, 200),
            userId: ctx.userId,
            akteId: ctx.akteId,
            durationMs,
          });

          return result;
        } catch (error: unknown) {
          const durationMs = Date.now() - startMs;
          const errorMsg =
            error instanceof Error ? error.message : "Unbekannter Fehler";

          logToolCall({
            toolName,
            params: (args as Record<string, unknown>) ?? {},
            resultSummary: `ERROR: ${errorMsg}`,
            userId: ctx.userId,
            akteId: ctx.akteId,
            durationMs,
          });

          return { error: errorMsg };
        }
      };

      allTools[toolName] = {
        ...baseTool,
        execute: wrappedExecute,
      } as CoreTool<any, any>;
    } else {
      allTools[toolName] = baseTool;
    }
  }

  // Apply role-based filtering
  return filterToolsByRole(allTools, options.userRole) as Record<
    string,
    CoreTool<any, any>
  >;
}
