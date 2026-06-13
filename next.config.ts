import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist (via pdf-to-img) loads a worker file at runtime, and
  // @napi-rs/canvas ships a native binary; let Node resolve them from
  // node_modules instead of bundling them.
  serverExternalPackages: ["pdf-to-img", "pdfjs-dist", "@napi-rs/canvas"],

  // pdfjs loads its worker, standard fonts, and cmaps via runtime file paths
  // the tracer can't follow, so they're dropped from the serverless bundle —
  // causing "Cannot find pdf.worker.mjs" and, once that's fixed, blank text
  // (no fonts) that parses to an empty bill. Force them into /api/upload.
  outputFileTracingIncludes: {
    "/api/upload": [
      "./node_modules/pdfjs-dist/legacy/build/**",
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/pdfjs-dist/cmaps/**",
    ],
  },
};

export default nextConfig;

