import path from "path";
import type { NextConfig } from "next";

const isProductionBuild = process.env.NODE_ENV === "production";
const canvasShimRelative = "./src/lib/pdf/canvas-shim.ts";
const canvasShimAbsolute = path.resolve(__dirname, "src/lib/pdf/canvas-shim.ts");

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  ...(isProductionBuild ? { assetPrefix: "./" } : {}),
  images: { unoptimized: true },

  // 👇 silences the “inferred workspace root” warning
  turbopack: {
    root: __dirname,
    resolveAlias: {
      canvas: canvasShimRelative,
    },
  },

  // Optional: don’t fail production builds on ESLint issues
  // eslint: { ignoreDuringBuilds: true },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.alias = config.resolve.alias ?? {};
      config.resolve.alias.canvas = canvasShimAbsolute;
    }
    return config;
  },
};

export default nextConfig;
