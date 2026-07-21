import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Demo/seed photography. Replace with your own CDN host in production.
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  serverExternalPackages: ["@prisma/adapter-mariadb", "mariadb"],
};

export default nextConfig;
