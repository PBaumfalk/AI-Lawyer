import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";
import { emailUploadPrefix, type EmailUploadResponse } from "@/lib/email/send-contract";

const MAX_EMAIL_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * POST /api/email-send/anhang — upload a local file as email attachment.
 * multipart/form-data with field "file". The returned reference is sent to
 * POST /api/email-send as { quelle: "upload", ... }.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return Response.json({ error: "Keine Datei übermittelt" }, { status: 400 });
  }
  if (file.size > MAX_EMAIL_UPLOAD_BYTES) {
    return Response.json({ error: "Datei ist größer als 25 MB" }, { status: 413 });
  }

  const sanitized = (file.name || "anhang").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 120);
  const key = `${emailUploadPrefix(session.user.id)}${randomUUID()}_${sanitized}`;
  const mimeType = file.type || "application/octet-stream";
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(key, buffer, mimeType, buffer.length);

  const response: EmailUploadResponse = {
    speicherPfad: key,
    dateiname: file.name || sanitized,
    mimeType,
    groesse: buffer.length,
  };
  return Response.json(response, { status: 201 });
}
