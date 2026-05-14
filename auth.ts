import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { calisanAvatarPublicUrl } from "@/lib/calisan-avatar"
import { prisma } from "@/lib/prisma-server"
import { isRateLimited, rateLimit, resetRateLimit } from "@/lib/rate-limit"
import { authConfig } from "./auth.config"

declare module "next-auth" {
  interface User {
    departman?: string | null
  }
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      departman?: string | null
    }
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  cookies: {
    sessionToken: {
      name: "bonair.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 8 * 60 * 60, // 8 saat (iş günü)
      },
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = (credentials.email as string).toLowerCase().trim()
        const failKey = `login:fail:${email}`

        // Brute-force koruması: e-posta başına 10 dakikada 5 başarısız deneme
        const { limited, resetAt } = isRateLimited(failKey, 5, 10 * 60_000)
        if (limited) {
          const waitMin = Math.ceil((resetAt - Date.now()) / 60_000)
          console.warn(`[auth] Login blocked (rate limit) for: ${email}`)
          throw new Error(`TOO_MANY_ATTEMPTS:${waitMin}`)
        }

        const calisan = await prisma.calisan.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            password: true,
            isim: true,
            soyisim: true,
            departman: true,
            profilFotoStoragePath: true,
          },
        })

        if (!calisan || !calisan.password) {
          // Hesap bulunamadı — yine de sayacı artır (kullanıcı numaralandırmasını önle)
          rateLimit(failKey, 5, 10 * 60_000)
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          calisan.password
        )

        if (!isPasswordValid) {
          // Yanlış şifre — başarısız denemeyi kaydet
          rateLimit(failKey, 5, 10 * 60_000)
          return null
        }

        // Başarılı giriş — sayacı sıfırla
        resetRateLimit(failKey)

        return {
          id: String(calisan.id),
          email: calisan.email,
          name: `${calisan.isim || ""} ${calisan.soyisim || ""}`.trim() || null,
          image: calisanAvatarPublicUrl(calisan.profilFotoStoragePath),
          departman: calisan.departman,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        ;(token as any).id = user.id
        ;(token as any).departman = user.departman
        ;(token as any).image = user.image ?? null
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token as any).id as string
        session.user.departman = (token as any).departman
        session.user.image = (token as any).image ?? null
        const uid = Number.parseInt((token as any).id as string, 10)
        if (Number.isFinite(uid) && uid > 0) {
          try {
            const row = await prisma.calisan.findUnique({
              where: { id: uid },
              select: { profilFotoStoragePath: true, departman: true },
            })
            session.user.image =
              calisanAvatarPublicUrl(row?.profilFotoStoragePath) ?? null
            if (row) {
              session.user.departman = row.departman
            }
          } catch {
            /* Vercel / DB kesintisinde oturumu düşürme; JWT’deki görsel kalır */
          }
        }
      }
      return session
    },
  },
})
