import pino, { type Logger, type TransportTargetOptions } from "pino";

function buildTransport(): pino.TransportSingleOptions | pino.TransportMultiOptions | undefined {
  if (process.env.NODE_ENV !== "production") {
    // Development: use pino-pretty for human-readable colored output
    return {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    };
  }

  // During next build SSR prerendering, skip ALL transports to avoid
  // EACCES errors and worker thread issues in webpack-bundled context
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return undefined;
  }

  // Production runtime: stdout + file rotation via pino-roll
  const logFilePath =
    process.env.LOG_FILE_PATH || "/var/log/ai-lawyer/app";

  const targets: TransportTargetOptions[] = [
    {
      target: "pino/file",
      options: { destination: 1 }, // stdout
      level: "trace",
    },
    {
      target: "pino-roll",
      options: {
        file: logFilePath,
        frequency: "daily",
        size: "10m",
        mkdir: true,
        extension: ".log",
      },
      level: "trace",
    },
  ];

  return { targets };
}

/** Root pino logger instance. Prefer createLogger() for module-scoped loggers. */
export const rootLogger: Logger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: "ai-lawyer" },
  transport: buildTransport(),
});

/**
 * Create a child logger scoped to a module.
 * Usage: const log = createLogger("worker");
 */
export function createLogger(module: string): Logger {
  return rootLogger.child({ module });
}
