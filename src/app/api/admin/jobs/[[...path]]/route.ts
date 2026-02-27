import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ALL_QUEUES } from "@/lib/queue/queues";

/**
 * GET /api/admin/jobs — Returns queue status for all registered BullMQ queues.
 *
 * Bull Board's Hono adapter requires serveStatic which is complex in Next.js
 * App Router. Instead, we expose a JSON API that the admin page consumes
 * to render a custom queue dashboard.
 *
 * Requires ADMIN role.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const url = new URL(req.url);
  const pathSegments = url.pathname.replace("/api/admin/jobs", "").split("/").filter(Boolean);

  // /api/admin/jobs — list all queues with counts
  if (pathSegments.length === 0) {
    try {
      const queues = await Promise.all(
        ALL_QUEUES.map(async (queue) => {
          const counts = await queue.getJobCounts(
            "active",
            "completed",
            "failed",
            "delayed",
            "waiting",
            "paused"
          );
          return {
            name: queue.name,
            counts,
          };
        })
      );
      return NextResponse.json({ queues });
    } catch (err) {
      return NextResponse.json(
        { error: "Fehler beim Abrufen der Queue-Daten" },
        { status: 500 }
      );
    }
  }

  // /api/admin/jobs/:queueName — list jobs for a specific queue
  const queueName = pathSegments[0];
  const queue = ALL_QUEUES.find((q) => q.name === queueName);
  if (!queue) {
    return NextResponse.json(
      { error: `Queue '${queueName}' nicht gefunden` },
      { status: 404 }
    );
  }

  const status = url.searchParams.get("status") || "active";
  const page = parseInt(url.searchParams.get("page") || "0", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);

  try {
    let jobs;
    switch (status) {
      case "active":
        jobs = await queue.getJobs(["active"], page * pageSize, (page + 1) * pageSize - 1);
        break;
      case "completed":
        jobs = await queue.getJobs(["completed"], page * pageSize, (page + 1) * pageSize - 1);
        break;
      case "failed":
        jobs = await queue.getJobs(["failed"], page * pageSize, (page + 1) * pageSize - 1);
        break;
      case "delayed":
        jobs = await queue.getJobs(["delayed"], page * pageSize, (page + 1) * pageSize - 1);
        break;
      case "waiting":
        jobs = await queue.getJobs(["waiting"], page * pageSize, (page + 1) * pageSize - 1);
        break;
      default:
        jobs = await queue.getJobs(["active", "waiting", "completed", "failed", "delayed"], page * pageSize, (page + 1) * pageSize - 1);
    }

    const serialized = jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      opts: {
        attempts: job.opts?.attempts,
        delay: job.opts?.delay,
      },
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      timestamp: job.timestamp,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
    }));

    return NextResponse.json({ queue: queueName, status, jobs: serialized });
  } catch (err) {
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Jobs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/jobs/:queueName/:jobId/retry — Retry a failed job.
 * POST /api/admin/jobs/:queueName/clean — Clean completed/failed jobs.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const url = new URL(req.url);
  const pathSegments = url.pathname.replace("/api/admin/jobs", "").split("/").filter(Boolean);

  if (pathSegments.length < 2) {
    return NextResponse.json({ error: "Ungueltige Anfrage" }, { status: 400 });
  }

  const queueName = pathSegments[0];
  const queue = ALL_QUEUES.find((q) => q.name === queueName);
  if (!queue) {
    return NextResponse.json(
      { error: `Queue '${queueName}' nicht gefunden` },
      { status: 404 }
    );
  }

  // Clean action: /api/admin/jobs/:queueName/clean
  if (pathSegments[1] === "clean") {
    try {
      const body = await req.json();
      const status = body.status || "completed";
      const grace = body.grace || 0;
      const cleaned = await queue.clean(grace, 1000, status);
      return NextResponse.json({ cleaned: cleaned.length });
    } catch (err) {
      return NextResponse.json(
        { error: "Fehler beim Bereinigen der Queue" },
        { status: 500 }
      );
    }
  }

  // Trigger action: /api/admin/jobs/:queueName/trigger
  if (pathSegments[1] === "trigger") {
    try {
      const job = await queue.add("manual", {}, { attempts: 2 });
      return NextResponse.json({ success: true, jobId: job.id });
    } catch (err) {
      return NextResponse.json(
        { error: "Fehler beim Starten des Jobs" },
        { status: 500 }
      );
    }
  }

  // Retry action: /api/admin/jobs/:queueName/:jobId/retry
  if (pathSegments.length >= 3 && pathSegments[2] === "retry") {
    const jobId = pathSegments[1];
    try {
      const job = await queue.getJob(jobId);
      if (!job) {
        return NextResponse.json({ error: "Job nicht gefunden" }, { status: 404 });
      }
      await job.retry();
      return NextResponse.json({ success: true, jobId });
    } catch (err) {
      return NextResponse.json(
        { error: "Fehler beim Wiederholen des Jobs" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Ungueltige Anfrage" }, { status: 400 });
}

/**
 * PUT handler — placeholder for Bull Board adapter compatibility.
 */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  return NextResponse.json({ error: "Nicht implementiert" }, { status: 501 });
}
