/**
 * Shared contract for POST /api/emails/bulk — used by the route, the list's
 * bulk bar, the row quick actions and the detail actions bar.
 */
import { z } from "zod";

export const EMAIL_BULK_AKTIONEN = [
  "markRead",
  "markUnread",
  "delete",
  "restore",
  "archive",
  "spam",
  "move",
] as const;

export type EmailBulkAktion = (typeof EMAIL_BULK_AKTIONEN)[number];

export const emailBulkSchema = z
  .object({
    emailIds: z.array(z.string().min(1)).min(1, "Mindestens eine E-Mail-ID erforderlich").max(500),
    action: z.enum(EMAIL_BULK_AKTIONEN),
    targetFolderId: z.string().optional(),
  })
  .refine((d) => d.action !== "move" || !!d.targetFolderId, {
    message: "Zielordner ist erforderlich",
    path: ["targetFolderId"],
  });

export type EmailBulkRequest = z.input<typeof emailBulkSchema>;

export interface EmailBulkResponse {
  updated: number;
  action: EmailBulkAktion;
}

/** Client helper: run a bulk action, throw with the server's message on failure. */
export async function emailBulkAktion(request: EmailBulkRequest): Promise<EmailBulkResponse> {
  const res = await fetch("/api/emails/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Aktion fehlgeschlagen");
  return data as EmailBulkResponse;
}
