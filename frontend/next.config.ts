import type { NextConfig } from "next";

// Standalone output so the Docker runner stage can ship a minimal
// node_modules slice plus the .next/standalone/ bundle without a full
// pnpm install at runtime (AC-CD19).
const config: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
};

export default config;
