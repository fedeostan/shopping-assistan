import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable strict mode to prevent double-invocation of effects that cause
  // race conditions between history import and external store sync in assistant-ui
  reactStrictMode: false,
};

export default nextConfig;
