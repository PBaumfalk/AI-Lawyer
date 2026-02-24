/**
 * Email parser: wraps mailparser simpleParser to extract structured data from raw MIME streams.
 */

import { simpleParser, type ParsedMail } from "mailparser";
import type { ParsedEmail, ParsedEmailAddress, ParsedAttachment, EmailPrioritaet } from "@/lib/email/types";
import { Readable } from "node:stream";

/**
 * Extract structured email addresses from mailparser's AddressObject or AddressObject[].
 */
function extractAddresses(
  addrs: ParsedMail["from"] | ParsedMail["to"]
): ParsedEmailAddress[] {
  if (!addrs) return [];

  // Handle array of AddressObjects (to, cc, bcc can be arrays)
  if (Array.isArray(addrs)) {
    return addrs.flatMap((a) => {
      if ("value" in a) {
        return a.value.map((v) => ({
          address: v.address ?? "",
          name: v.name || undefined,
        }));
      }
      return [];
    });
  }

  // Single AddressObject (from)
  if ("value" in addrs) {
    return addrs.value.map((a) => ({
      address: a.address ?? "",
      name: a.name || undefined,
    }));
  }

  return [];
}

/**
 * Map X-Priority header values to our EmailPrioritaet enum.
 * X-Priority: 1 (Highest), 2 (High), 3 (Normal), 4 (Low), 5 (Lowest)
 */
function parsePriority(headers: ParsedMail["headers"]): EmailPrioritaet {
  const xPriority = headers.get("x-priority");
  if (!xPriority) return "NORMAL";

  const val = typeof xPriority === "string" ? xPriority : String(xPriority);
  const num = parseInt(val, 10);

  if (num <= 2) return "HOCH";
  if (num >= 4) return "NIEDRIG";
  return "NORMAL";
}

/**
 * Parse a raw MIME email stream into a structured ParsedEmail object.
 * Uses mailparser's simpleParser for reliable MIME handling.
 *
 * @param source - Raw email content as Buffer, string, or Readable stream
 * @returns Parsed email with headers, body, attachments
 */
export async function parseRawEmail(
  source: Buffer | string | Readable
): Promise<ParsedEmail> {
  const parsed = await simpleParser(source, {
    skipHtmlToText: false,
    skipTextToHtml: false,
    skipImageLinks: false,
    maxHtmlLengthToParse: 10 * 1024 * 1024, // 10MB max HTML
  });

  const from = extractAddresses(parsed.from);
  const to = extractAddresses(parsed.to);
  const cc = extractAddresses(parsed.cc);
  const bcc = extractAddresses(parsed.bcc);

  // Extract references from header (array of Message-IDs)
  const referencesHeader = parsed.references;
  const references: string[] = Array.isArray(referencesHeader)
    ? referencesHeader
    : referencesHeader
      ? [referencesHeader]
      : [];

  // Extract attachments metadata
  const attachments: ParsedAttachment[] = (parsed.attachments ?? []).map((att) => ({
    filename: att.filename ?? "attachment",
    mimeType: att.contentType ?? "application/octet-stream",
    size: att.size ?? 0,
    contentId: att.contentId ?? undefined,
    content: att.content,
  }));

  // Build headers map from parsed headers
  const headers = new Map<string, string>();
  if (parsed.headers) {
    parsed.headers.forEach((value, key) => {
      headers.set(key, typeof value === "string" ? value : JSON.stringify(value));
    });
  }

  return {
    messageId: parsed.messageId ?? undefined,
    inReplyTo: parsed.inReplyTo ?? undefined,
    references,
    subject: parsed.subject ?? "(Kein Betreff)",
    from: from[0] ?? { address: "unknown@unknown" },
    to,
    cc,
    bcc,
    html: parsed.html || undefined,
    text: parsed.text || undefined,
    date: parsed.date ?? undefined,
    priority: parsePriority(parsed.headers),
    size: undefined, // Set by caller from IMAP metadata
    attachments,
    headers,
  };
}
