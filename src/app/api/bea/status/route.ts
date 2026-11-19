import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getBeaProvider } from "@/lib/bea/provider";
import { zertifikatInfo } from "@/lib/bea/zertifikat";
import { anzahlUebersprungen } from "@/lib/bea/fehlversuche";

// GET /api/bea/status -- is beA configured, the caller's certificate metadata (no secrets)
// and the number of messages of the certificate's postbox that are skipped after repeated failures
export async function GET() {
  const result = await requirePermission("canReadBeA");
  if (result.error) return result.error;

  const zertifikat = await zertifikatInfo(result.session.user.id);
  return NextResponse.json({
    eingerichtet: getBeaProvider() !== null,
    zertifikat,
    uebersprungen: zertifikat?.safeId ? await anzahlUebersprungen(zertifikat.safeId) : 0,
  });
}
