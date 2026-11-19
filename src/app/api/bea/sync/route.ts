import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getBeaProvider } from "@/lib/bea/provider";
import { zertifikatInfo } from "@/lib/bea/zertifikat";
import { beaSyncQueue } from "@/lib/queue/queues";

// POST /api/bea/sync -- enqueue a retrieval for the caller's own certificate
export async function POST() {
  const result = await requirePermission("canReadBeA");
  if (result.error) return result.error;
  const userId = result.session.user.id;

  if (!getBeaProvider()) {
    return NextResponse.json({ error: "beA ist nicht eingerichtet" }, { status: 503 });
  }

  const zertifikat = await zertifikatInfo(userId);
  if (!zertifikat) {
    return NextResponse.json({ error: "Kein beA-Zertifikat hinterlegt" }, { status: 409 });
  }
  if (zertifikat.status !== "AKTIV") {
    return NextResponse.json(
      { error: zertifikat.letzterFehler ?? "Das beA-Zertifikat ist gesperrt. Bitte neu hochladen." },
      { status: 409 },
    );
  }

  await beaSyncQueue.add(
    "bea-sync",
    { userId },
    {
      jobId: `bea-sync-${userId}-${Date.now()}`,
      removeOnComplete: { age: 3_600 },
      removeOnFail: { age: 86_400 },
    },
  );

  return NextResponse.json({ message: "beA-Abruf gestartet" }, { status: 202 });
}
