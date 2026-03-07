import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";

// GET — return current config (password masked)
export async function GET() {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ["jlawyer.url", "jlawyer.username", "jlawyer.password"] } },
  });
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  return NextResponse.json({
    url: map["jlawyer.url"] ?? "",
    username: map["jlawyer.username"] ?? "",
    hasPassword: !!map["jlawyer.password"],
  });
}

// POST — save credentials
export async function POST(req: NextRequest) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  const body = await req.json();
  const { url, username, password } = body as {
    url?: string;
    username?: string;
    password?: string;
  };

  const upserts: Array<{ key: string; value: string }> = [];
  if (url !== undefined) upserts.push({ key: "jlawyer.url", value: url });
  if (username !== undefined) upserts.push({ key: "jlawyer.username", value: username });
  if (password !== undefined && password !== "") upserts.push({ key: "jlawyer.password", value: password });

  for (const { key, value } of upserts) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value, type: "string", category: "jlawyer" },
      update: { value },
    });
  }

  return NextResponse.json({ success: true });
}
