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
  async redirects() {
    return [
      {
        source: "/configurations/aircraft-settings",
        destination: "/documents/aircraft-settings",
        permanent: false,
      },
      {
        source: "/configurations/aircraft-settings/archived",
        destination: "/documents/aircraft-settings/archived",
        permanent: false,
      },
      {
        source: "/configurations/aircraft-settings/:id",
        destination: "/documents/aircraft-settings/:id",
        permanent: false,
      },
    ];
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
