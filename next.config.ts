import type { NextConfig } from "next";

// GitHub Pages serves the site from /<repo>. The deploy workflow sets
// NEXT_PUBLIC_BASE_PATH; locally it is empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
