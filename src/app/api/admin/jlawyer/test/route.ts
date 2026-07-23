import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { JLawyerClient } from "@/lib/jlawyer/client";
import { decryptJLawyerPassword } from "@/lib/jlawyer/credentials";
import { validateJLawyerBaseUrl } from "@/lib/jlawyer/validate-url";

export async function POST(req: NextRequest) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  // Optionally accept override credentials in body (for testing before saving)
  const body = await req.json().catch(() => ({})) as {
    url?: string;
    username?: string;
    password?: string;
  };

  let baseUrl = body.url;
  let username = body.username;
  let password = body.password;

  // Fall back to stored credentials if not provided in body
  if (!baseUrl || !username || !password) {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ["jlawyer.url", "jlawyer.username", "jlawyer.password"] } },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    baseUrl = baseUrl || map["jlawyer.url"];
    username = username || map["jlawyer.username"];
    password = password || (map["jlawyer.password"] ? decryptJLawyerPassword(map["jlawyer.password"]) : undefined);
  }

  if (!baseUrl || !username || !password) {
    return NextResponse.json({ ok: false, error: "Verbindungsdaten fehlen" }, { status: 400 });
  }

  // SSRF guard: reject private/plain-http targets unless explicitly allowed
  const validation = validateJLawyerBaseUrl(baseUrl);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const client = new JLawyerClient({ baseUrl, username, password });
  const { ok, error } = await client.testConnection();

  return NextResponse.json({ ok, error });
}
