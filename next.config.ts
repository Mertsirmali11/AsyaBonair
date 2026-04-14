import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@tabler/icons-react",
      "recharts",
      "date-fns",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-collapsible",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "class-variance-authority",
      "clsx",
      "zod",
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
  serverExternalPackages: [
    "@prisma/client",
    "pg",
    "@prisma/adapter-pg",
    "pdf-parse",
    "officeparser",
  ],
};

export default nextConfig;
