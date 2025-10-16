import type { NextConfig } from "next";

const isProductionBuild = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  ...(isProductionBuild ? { assetPrefix: "./" } : {}),
  images: { unoptimized: true },

  // 👇 silences the “inferred workspace root” warning
  turbopack: {
    root: __dirname,
  },

  // Optional: don’t fail production builds on ESLint issues
  // eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
