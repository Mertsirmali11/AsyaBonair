import NextAuth from "next-auth"

import { authConfig } from "./auth.config"

/**
 * Edge’de çalışır — @/auth (Prisma/bcrypt) buraya import edilmemeli; Vercel’de MIDDLEWARE_INVOCATION_FAILED olur.
 * Oturum: aynı AUTH_SECRET ile JWT doğrulanır; sunucu tarafı session auth.ts içinde.
 */
const { auth } = NextAuth(authConfig)

export default auth

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

