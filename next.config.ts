import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Daystream runs behind a custom Node server (server/index.mjs) that also
  // hosts the Hocuspocus WebSocket endpoint, so no `output: "standalone"`.
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
