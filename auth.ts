import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { calisanAvatarPublicUrl } from "@/lib/calisan-avatar"
import { prisma } from "@/lib/prisma-server"
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

        const calisan = await prisma.calisan.findUnique({
          where: {
            email: credentials.email as string,
          },
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
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          calisan.password
        )

        if (!isPasswordValid) {
          return null
        }

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
