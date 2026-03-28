import { auth } from "@/auth"

/** auth.ts ile aynı örnek — aksi halde Edge’teki JWT ile Node’daki session uyumsuz kalıp /login ↔ /dashboard döngüsü oluşabiliyor (Vercel). */
export default auth

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

