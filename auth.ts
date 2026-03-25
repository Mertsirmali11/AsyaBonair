import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
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
          image: null,
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
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token as any).id as string
        session.user.departman = (token as any).departman
      }
      return session
    },
  },
})
