import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist (via pdf-to-img) loads a worker file at runtime; let Node
  // resolve it from node_modules instead of bundling it.
  serverExternalPackages: ["pdf-to-img", "pdfjs-dist"],
};

export default nextConfig;

