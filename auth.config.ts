import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const path = nextUrl.pathname
      const needsAuth =
        path.startsWith("/dashboard") ||
        path.startsWith("/messages")
      const isOnAuthPage =
        path.startsWith("/login") || path.startsWith("/register")

      if (needsAuth) {
        if (isLoggedIn) return true
        return false
      }

      if (isOnAuthPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl))
        }
        return true
      }

      return true
    },
  },
  providers: [],
}

