import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { calisanAvatarPublicUrl } from "@/lib/calisan-avatar"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { prisma } from "@/lib/prisma-server"
import {
  deleteCalisanAvatarFromStorage,
  uploadCalisanAvatarToStorage,
  CALISAN_AVATAR_MAX_BYTES,
  resolveCalisanAvatarMime,
} from "@/lib/supabase-storage"

async function requireConfigAdmin() {
  const session = await auth()
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  if (!canAccessConfigurationsArea(session.user.departman)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { session }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireConfigAdmin()
  if ("error" in gate) return gate.error

  const { id: raw } = await params
  const calisanId = Number.parseInt(raw, 10)
  if (!Number.isFinite(calisanId) || calisanId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const form = await request.formData()
  const file = form.get("file")
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file gerekli" }, { status: 400 })
  }
  if (file.size > CALISAN_AVATAR_MAX_BYTES) {
    return NextResponse.json(
      { error: `Dosya en fazla ${CALISAN_AVATAR_MAX_BYTES / (1024 * 1024)} MB olabilir` },
      { status: 400 }
    )
  }
  const mime = resolveCalisanAvatarMime(file)
  if (!mime) {
    return NextResponse.json(
      {
        error:
          "Yalnızca JPEG, PNG, GIF veya WebP yükleyin. Tür algılanmazsa dosya adında .jpg / .png vb. olsun.",
      },
      { status: 400 }
    )
  }

  const existing = await prisma.calisan.findUnique({
    where: { id: calisanId },
    select: { id: true, profilFotoStoragePath: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Çalışan bulunamadı" }, { status: 404 })
  }

  if (existing.profilFotoStoragePath) {
    await deleteCalisanAvatarFromStorage(existing.profilFotoStoragePath)
  }

  const uploaded = await uploadCalisanAvatarToStorage(file, calisanId)
  if (!uploaded.ok) {
    return NextResponse.json({ error: uploaded.message }, { status: 500 })
  }

  await prisma.calisan.update({
    where: { id: calisanId },
    data: { profilFotoStoragePath: uploaded.path },
  })

  return NextResponse.json({
    profilFotoUrl: calisanAvatarPublicUrl(uploaded.path),
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireConfigAdmin()
  if ("error" in gate) return gate.error

  const { id: raw } = await params
  const calisanId = Number.parseInt(raw, 10)
  if (!Number.isFinite(calisanId) || calisanId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const existing = await prisma.calisan.findUnique({
    where: { id: calisanId },
    select: { id: true, profilFotoStoragePath: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Çalışan bulunamadı" }, { status: 404 })
  }

  if (existing.profilFotoStoragePath) {
    await deleteCalisanAvatarFromStorage(existing.profilFotoStoragePath)
  }

  await prisma.calisan.update({
    where: { id: calisanId },
    data: { profilFotoStoragePath: null },
  })

  return NextResponse.json({ profilFotoUrl: null as string | null })
}
