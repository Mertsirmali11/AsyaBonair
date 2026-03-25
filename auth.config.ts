import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard")
      const isOnAuthPage = nextUrl.pathname.startsWith("/login") || 
                          nextUrl.pathname.startsWith("/register")

      if (isOnDashboard) {
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

