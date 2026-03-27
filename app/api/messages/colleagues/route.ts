import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { calisanAvatarPublicUrl } from "@/lib/calisan-avatar"
import { prisma } from "@/lib/prisma-server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const myId = Number.parseInt(session.user.id, 10)
  if (Number.isNaN(myId)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 })
  }

  const myEmail = session.user.email?.trim()

  const rows = await prisma.calisan.findMany({
    where: {
      NOT: {
        OR: [{ id: myId }, ...(myEmail ? [{ email: myEmail }] : [])],
      },
    },
    select: {
      id: true,
      isim: true,
      soyisim: true,
      departman: true,
      profilFotoStoragePath: true,
    },
    orderBy: [{ isim: "asc" }, { soyisim: "asc" }],
  })

  return NextResponse.json({
    colleagues: rows.map((c) => ({
      id: c.id,
      isim: c.isim,
      soyisim: c.soyisim,
      departman: c.departman,
      displayName: [c.isim, c.soyisim].filter(Boolean).join(" ") || `Employee #${c.id}`,
      avatarUrl: calisanAvatarPublicUrl(c.profilFotoStoragePath),
    })),
  })
}
