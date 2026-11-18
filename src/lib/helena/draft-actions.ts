/**
 * PATCH /api/helena/drafts/[id] body. Shared by the route and the draft UI
 * (inbox, detail modal) so the actions cannot drift apart. Client-safe.
 */
import { z } from "zod";

export const DraftActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({
    action: z.literal("reject"),
    categories: z.array(z.string()).optional(),
    text: z.string().optional(),
    noRevise: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("edit"),
    titel: z.string().trim().min(1, "Titel darf nicht leer sein").optional(),
    inhalt: z.string().optional(),
    meta: z.record(z.unknown()).optional(),
  }),
]);

export type DraftAction = z.infer<typeof DraftActionSchema>;

export function draftUrl(draftId: string): string {
  return `/api/helena/drafts/${encodeURIComponent(draftId)}`;
}
