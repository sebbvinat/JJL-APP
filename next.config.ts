import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // Tree-shaking más agresivo en libs con muchos named exports.
    // Reduce el bundle del cliente sin tocar código de aplicación.
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
};

export default nextConfig;
