import * as esbuild from "esbuild";
import path from "path";

async function buildWorker() {
  console.log("Building worker bundle...");

  await esbuild.build({
    entryPoints: [path.resolve("src/worker.ts")],
    outfile: path.resolve("dist-worker/index.js"),
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    // Worker only needs @prisma/client external (no next, no sharp)
    // pino + transports must be external — pino spawns worker threads that need separate files
    external: ["@prisma/client", "pino", "pino-roll", "pino-pretty", "pino/file", "pdf-parse"],
    banner: {
      js: 'import { createRequire } from "module"; import { fileURLToPath as __fileURLToPath } from "url"; import { dirname as __dirnameFn } from "path"; const require = createRequire(import.meta.url); const __filename = __fileURLToPath(import.meta.url); const __dirname = __dirnameFn(__filename);',
    },
    // Resolve @/* path alias
    alias: {
      "@": "./src",
    },
    logLevel: "info",
  });

  console.log("Worker bundle created: dist-worker/index.js");
}

buildWorker().catch((err) => {
  console.error("Worker build failed:", err);
  process.exit(1);
});
