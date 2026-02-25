import next from "next";
import { createServer } from "node:http";
import { parse } from "node:url";
import { setupSocketIO } from "@/lib/socket/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("server");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

async function main() {
  const app = next({ dev, hostname, port });
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
