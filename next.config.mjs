/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverComponentsExternalPackages: [
      "bullmq", "ioredis", "pino", "pino-roll", "pino-pretty",
      "pdf-parse", "imapflow", "nodemailer", "@prisma/client",
    ],
    // Turbopack: alias @napi-rs/canvas to empty module -- pdfjs-dist optional
    // Node.js dependency that is not needed in the browser (client components)
    turbo: {
      resolveAlias: {
        "@napi-rs/canvas": { browser: "./src/lib/empty-module.ts" },
        canvas: { browser: "./src/lib/empty-module.ts" },
      },
    },
  },

  // Webpack: alias @napi-rs/canvas and canvas to empty module for client-side builds
  // (pdfjs-dist optionally requires these for Node.js server-side rendering)
  webpack: (config, { isServer }) => {
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
