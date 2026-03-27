import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@tabler/icons-react",
      "recharts",
      "date-fns",
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${process.env.PROXY_URL || "http://localhost:8080"}/:path*`,
      },
    ];
  },
  serverExternalPackages: ["@prisma/client", "pg", "@prisma/adapter-pg"],
};

export default nextConfig;
