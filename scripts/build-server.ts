import * as esbuild from "esbuild";
import path from "path";

async function buildServer() {
  console.log("Building server bundle...");

  await esbuild.build({
    entryPoints: [path.resolve("src/server.ts")],
    outfile: path.resolve("dist-server/index.js"),
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    // Externals: loaded from node_modules at runtime
    // pino + transports must be external — pino spawns worker threads that need separate files
    external: ["next", "sharp", "@prisma/client", "pino", "pino-roll", "pino-pretty", "pino/file"],
    banner: {
      js: 'import { createRequire } from "module"; import { fileURLToPath as __fileURLToPath } from "url"; import { dirname as __dirnameFn } from "path"; const require = createRequire(import.meta.url); const __filename = __fileURLToPath(import.meta.url); const __dirname = __dirnameFn(__filename);',
    },
    // Resolve @/* path alias
    alias: {
      "@": "./src",
    },
    // Suppress warnings about require() in ESM
    logLevel: "info",
  });

  console.log("Server bundle created: dist-server/index.js");
}

buildServer().catch((err) => {
  console.error("Server build failed:", err);
  process.exit(1);
});
