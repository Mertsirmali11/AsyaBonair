import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  // Clickjacking koruması
  { key: "X-Frame-Options", value: "DENY" },
  // MIME sniffing koruması
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer bilgisini sınırla
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // HTTPS zorunluluğu (1 yıl, subdomain dahil)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Gereksiz tarayıcı özelliklerini kapat
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // XSS koruması (modern tarayıcılarda CSP ile desteklenir)
  { key: "X-XSS-Protection", value: "1; mode=block" },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ]
  },
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
    // Proxy yalnızca PROXY_URL açıkça tanımlandığında etkin olur.
    // Tanımsızken localhost:8080'e yönlendirme yapılmaz (SSRF riski).
    if (!process.env.PROXY_URL) return []
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${process.env.PROXY_URL}/:path*`,
      },
    ]
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
