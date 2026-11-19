import { fileURLToPath } from "node:url";

// Persimmon icons: every `import … from "lucide-react"` resolves to the
// central icon module (see src/components/icons/lucide-compat.tsx).
const iconModule = fileURLToPath(new URL("./src/components/icons/lucide-compat.tsx", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: [
    "bullmq", "ioredis", "pino", "pino-roll", "pino-pretty",
    "pdf-parse", "imapflow", "nodemailer", "@prisma/client",
  ],
  // Turbopack: alias @napi-rs/canvas to empty module -- pdfjs-dist optional
  // Node.js dependency that is not needed in the browser (client components)
  turbopack: {
    resolveAlias: {
      "lucide-react": "./src/components/icons/lucide-compat.tsx",
      "@napi-rs/canvas": { browser: "./src/lib/empty-module.ts" },
      canvas: { browser: "./src/lib/empty-module.ts" },
    },
  },

  // Webpack: alias @napi-rs/canvas and canvas to empty module for client-side builds
  // (pdfjs-dist optionally requires these for Node.js server-side rendering)
  webpack: (config, { isServer }) => {
    // Exact match only ($): the icon module itself imports
    // "lucide-react/dist/esm/lucide-react.js".
    config.resolve.alias = { ...config.resolve.alias, "lucide-react$": iconModule };
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@napi-rs/canvas": false,
        canvas: false,
      };
    }
    return config;
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
      // Allow ONLYOFFICE download/callback endpoints to be accessed from Docker
      {
        source: "/api/onlyoffice/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
