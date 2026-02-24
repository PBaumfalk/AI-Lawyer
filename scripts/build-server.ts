import * as esbuild from "esbuild";
import path from "path";

async function buildServer() {
  console.log("Building server bundle...");

  await esbuild.build({
    entryPoints: [path.resolve("src/server.ts")],
    outfile: path.resolve("dist-server/index.js"),
    bundle: true,
    platform: "node",
    target: "node18",
    format: "esm",
    // Externals: loaded from node_modules at runtime
    external: ["next", "sharp", "@prisma/client"],
    banner: {
      js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
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
