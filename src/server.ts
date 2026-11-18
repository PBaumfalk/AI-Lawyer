import next from "next";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "node:url";
import { setupSocketIO } from "@/lib/socket/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("server");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

/**
 * In the production image only the Next.js standalone output exists. Calling
 * next() there would re-load next.config and pull in webpack, which is not
 * shipped (that is why the image used to start .next/standalone/server.js and
 * silently lost Socket.IO). Like the generated standalone server, pass the
 * config frozen at build time instead.
 */
function standaloneConfig(): Record<string, unknown> | undefined {
  if (dev) return undefined;
  const file = join(process.cwd(), ".next", "required-server-files.json");
  if (!existsSync(file)) return undefined;
  const { config } = JSON.parse(readFileSync(file, "utf8"));
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config);
  return config;
}

async function main() {
  const conf = standaloneConfig();
  const app = next({ dev, hostname, port, dir: process.cwd(), ...(conf ? { conf: conf as any } : {}) });
  const handle = app.getRequestHandler();

  await app.prepare();
  log.info("Next.js app prepared");

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url || "/", true);
    handle(req, res, parsedUrl);
  });

  // Attach Socket.IO to the same HTTP server
  const io = setupSocketIO(httpServer);
  log.info("Socket.IO attached to HTTP server");

  // Store io instance for potential access (e.g., from API routes)
  (globalThis as any).__socketIO = io;

  httpServer.listen(port, hostname, () => {
    log.info(
      { hostname, port, dev },
      `Server ready at http://${hostname}:${port}`
    );
  });
}

main().catch((err) => {
  console.error("Server startup failed:", err);
  log.error({ err }, "Server startup failed");
  process.exit(1);
});
