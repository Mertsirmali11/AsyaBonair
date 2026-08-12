import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  cookies: {
    sessionToken: {
      name: "bonair.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 8 * 60 * 60, // 8 saat
      },
    },
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const path = nextUrl.pathname

      // Public paths: login, register, API routes, static assets,
      // Public Audit Response Link (token-authenticated, no Bonjour account required)
      const isPublic =
        path.startsWith("/login") ||
        path.startsWith("/register") ||
        path.startsWith("/audit-response") ||
        path.startsWith("/api/") ||
        path.startsWith("/_next/") ||
        path.startsWith("/favicon") ||
        path === "/"

      // Authenticated users trying to access auth pages → redirect to dashboard
      if ((path.startsWith("/login") || path.startsWith("/register")) && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl))
      }

      // Public paths always pass through
      if (isPublic) return true

      // Everything else requires authentication
      if (!isLoggedIn) {
        const loginUrl = new URL("/login", nextUrl)
        loginUrl.searchParams.set("callbackUrl", path)
        return Response.redirect(loginUrl)
      }

      return true
    },
  },
  providers: [],
}

