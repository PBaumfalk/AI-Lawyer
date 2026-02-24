import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Redis from "ioredis";
import { testQueue } from "@/lib/queue/queues";

interface ServiceStatus {
  status: "healthy" | "unhealthy";
  latency?: number;
  error?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded";
  timestamp: string;
  uptime: number;
  services: Record<string, ServiceStatus>;
}

/** Check PostgreSQL connectivity and measure latency */
async function checkPostgres(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "healthy", latency: Date.now() - start };
  } catch (err) {
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/** Check Redis connectivity with a short-lived connection */
async function checkRedis(): Promise<ServiceStatus> {
  const start = Date.now();
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const redis = new Redis(url, {
    connectTimeout: 3000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // Do not retry during health check
  });

  try {
    await redis.ping();
    return { status: "healthy", latency: Date.now() - start };
  } catch (err) {
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  } finally {
    redis.disconnect();
  }
}

/** Check MinIO (S3) connectivity via HEAD request */
async function checkMinio(): Promise<ServiceStatus> {
  const start = Date.now();
  const endpoint = process.env.MINIO_ENDPOINT || "localhost";
  const port = process.env.MINIO_PORT || "9000";
  const useSsl = process.env.MINIO_USE_SSL === "true";
  const protocol = useSsl ? "https" : "http";
  const url = `${protocol}://${endpoint}:${port}/minio/health/live`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    return {
      status: res.ok ? "healthy" : "unhealthy",
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/** Check Meilisearch health endpoint */
async function checkMeilisearch(): Promise<ServiceStatus> {
  const start = Date.now();
  const url = process.env.MEILISEARCH_URL || "http://localhost:7700";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);

    return {
      status: res.ok ? "healthy" : "unhealthy",
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/** Check OnlyOffice health endpoint */
async function checkOnlyOffice(): Promise<ServiceStatus> {
  const start = Date.now();
  const url =
    process.env.ONLYOFFICE_INTERNAL_URL || "http://localhost:8080";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${url}/healthcheck`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // OnlyOffice returns "true" in the body when healthy
    const body = await res.text();
    return {
      status: body === "true" ? "healthy" : "unhealthy",
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/** Check if a BullMQ worker is registered on the test queue */
async function checkWorker(): Promise<ServiceStatus> {
  const start = Date.now();

  try {
    const workers = await testQueue.getWorkers();
    return {
      status: workers.length > 0 ? "healthy" : "unhealthy",
      latency: Date.now() - start,
      ...(workers.length === 0 && { error: "No workers registered" }),
    };
  } catch (err) {
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * GET /api/health — Public health check endpoint.
 * Returns JSON with status of every infrastructure service.
 * Used by Docker Compose healthcheck (no auth required).
 */
export async function GET() {
  const [postgres, redis, minio, meilisearch, onlyoffice, worker] =
    await Promise.all([
      checkPostgres(),
      checkRedis(),
      checkMinio(),
      checkMeilisearch(),
      checkOnlyOffice(),
      checkWorker(),
    ]);

  const services: Record<string, ServiceStatus> = {
    postgres,
    redis,
    minio,
    meilisearch,
    onlyoffice,
    worker,
  };

  // Aggregate: all healthy -> 200, otherwise -> 503 degraded
  // Core services: postgres and redis must be healthy for 200
  const coreHealthy =
    postgres.status === "healthy" && redis.status === "healthy";
  const allHealthy = Object.values(services).every(
    (s) => s.status === "healthy"
  );

  const response: HealthResponse = {
    status: allHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services,
  };

  // Return 200 if core services are healthy (Docker healthcheck passes),
  // 503 only if core services are down
  return NextResponse.json(response, {
    status: coreHealthy ? 200 : 503,
  });
}
