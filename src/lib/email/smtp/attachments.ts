import { getFileStream } from "@/lib/storage";

export interface SmtpAnhangQuelle {
  dateiname: string;
  mimeType: string;
  speicherPfad: string;
  contentId: string | null;
}

export interface SmtpAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  cid?: string;
}

async function ladeAusSpeicher(key: string): Promise<Buffer> {
  const body: any = await getFileStream(key);
  if (!body) throw new Error(`Anhang ${key} nicht im Speicher gefunden`);
  if (typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/**
 * Build nodemailer attachments with their content loaded from object storage.
 * Throws if any attachment cannot be loaded, so the mail is never sent
 * without an attachment the user selected.
 */
export async function buildSmtpAttachments(
  anhaenge: SmtpAnhangQuelle[],
  laden: (key: string) => Promise<Buffer> = ladeAusSpeicher
): Promise<SmtpAttachment[]> {
  return Promise.all(
    anhaenge.map(async (a) => {
      let content: Buffer;
      try {
        content = await laden(a.speicherPfad);
      } catch (err) {
        throw new Error(
          `Anhang "${a.dateiname}" konnte nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      return {
        filename: a.dateiname,
        content,
        contentType: a.mimeType,
        ...(a.contentId ? { cid: a.contentId } : {}),
      };
    })
  );
}
