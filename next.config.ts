import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
