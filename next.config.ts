import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Demo/seed photography. Replace with your own CDN host in production.
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  serverExternalPackages: ["@prisma/adapter-mariadb", "mariadb"],
  experimental: {
    // Admin image uploads go through Server Actions, whose body defaults to a
    // 1 MB cap — anything larger 500s with "Body exceeded 1 MB limit" before the
    // action runs. Raise it to match saveUpload()'s 20 MB limit (and the 25 M
    // nginx client_max_body_size in front of it).
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
