import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getBeaProvider } from "@/lib/bea/provider";
import { zertifikatInfo } from "@/lib/bea/zertifikat";

// GET /api/bea/status -- is beA configured, and the caller's certificate metadata (no secrets)
export async function GET() {
  const result = await requirePermission("canReadBeA");
  if (result.error) return result.error;

  return NextResponse.json({
    eingerichtet: getBeaProvider() !== null,
    zertifikat: await zertifikatInfo(result.session.user.id),
  });
}
