import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { downloadCalisanAvatarFromStorage } from "@/lib/supabase-storage"

function mimeFromStoragePath(p: string): string {
  const lower = p.toLowerCase()
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".gif")) return "image/gif"
  return "image/jpeg"
}

/**
 * Profil fotoğraflarını giriş yapmış kullanıcıya sunar.
 * Doğrudan Supabase public URL yerine proxy kullanılır; bucket private olsa bile görüntülenir.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { path: segments } = await params
  if (!segments?.length) {
    return new NextResponse("Bad request", { status: 400 })
  }

  const storagePath = segments.join("/")
  if (!storagePath.startsWith("calisan-avatars/")) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const buf = await downloadCalisanAvatarFromStorage(storagePath)
  if (!buf) {
    return new NextResponse("Not found", { status: 404 })
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": mimeFromStoragePath(storagePath),
      "Cache-Control": "private, max-age=120",
    },
  })
}
