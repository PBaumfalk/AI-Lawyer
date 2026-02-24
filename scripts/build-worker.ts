import * as esbuild from "esbuild";
import path from "path";

async function buildWorker() {
  console.log("Building worker bundle...");

  await esbuild.build({
    entryPoints: [path.resolve("src/worker.ts")],
    outfile: path.resolve("dist-worker/index.js"),
    bundle: true,
    platform: "node",
    target: "node18",
    format: "esm",
    // Worker only needs @prisma/client external (no next, no sharp)
    external: ["@prisma/client"],
    banner: {
      js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
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
