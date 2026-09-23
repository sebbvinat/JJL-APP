import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // La presentación de los 3 pilares es un HTML suelto que vive en
  // public/preonboarding/ (lo copia scripts/sync-preonboarding.mjs). Next sirve
  // los archivos de public/ por su ruta exacta, asi que sin esto
  // /preonboarding daria 404 y habria que entrar a /preonboarding/index.html.
  async rewrites() {
    return [{ source: '/preonboarding', destination: '/preonboarding/index.html' }];
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
