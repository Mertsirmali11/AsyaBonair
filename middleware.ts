import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

const { auth } = NextAuth(authConfig)

export default auth

export const config = {
  // Korunacak route'lar
  // Static dosyaları ve API route'larını hariç tut
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes) - NextAuth API route'ları hariç tutulmalı
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

