import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { JLawyerClient } from "@/lib/jlawyer/client";

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
    password = password || map["jlawyer.password"];
  }

  if (!baseUrl || !username || !password) {
    return NextResponse.json({ ok: false, error: "Verbindungsdaten fehlen" }, { status: 400 });
  }

  const client = new JLawyerClient({ baseUrl, username, password });
  const { ok, error } = await client.testConnection();

  return NextResponse.json({ ok, error });
}
