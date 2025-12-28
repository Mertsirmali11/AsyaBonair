import type { NextAuthConfig } from "next-auth"

// Edge-compatible auth config (Prisma olmadan)
// Bu config middleware'de kullanılır
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

      // Dashboard sayfaları - giriş yapılmış olmalı
      if (isOnDashboard) {
        if (isLoggedIn) return true
        return false // Login sayfasına yönlendir
      }

      // Auth sayfaları (login/register) - giriş yapılmamış olmalı
      if (isOnAuthPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl))
        }
        return true
      }

      return true
    },
  },
  providers: [], // Providers auth.ts'de tanımlanacak
}

