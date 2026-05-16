import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { indexManualChunks } from "@/lib/manual-chunk-indexer"
import { isAdminDepartment } from "@/lib/department-access"

/** Tek bir manuel için embedding indexleme — Supabase'deki 60 s serverless sınırı. */
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Yalnızca Admin departmanı erişebilir
    const calisan = await prisma.calisan.findFirst({
      where: { email: { equals: session.user.email, mode: "insensitive" } },
      select: { departman: true },
    })
    if (!calisan || !isAdminDepartment(calisan.departman)) {
      return NextResponse.json(
        { error: "Bu işlem için Admin yetkisi gerekiyor." },
        { status: 403 }
      )
    }

    const body = (await req.json()) as { manualId?: unknown }
    const manualId =
      typeof body.manualId === "number" ? body.manualId : parseInt(String(body.manualId ?? ""))
    if (!manualId || isNaN(manualId)) {
      return NextResponse.json({ error: "manualId zorunlu." }, { status: 400 })
    }

    const manual = await prisma.companyManual.findUnique({
      where: { id: manualId },
      select: { id: true, title: true, contentText: true },
    })
    if (!manual) {
      return NextResponse.json({ error: "Manuel bulunamadı." }, { status: 404 })
    }

    const chunkCount = await indexManualChunks(manual.id, manual.contentText)

    return NextResponse.json({
      manualId: manual.id,
      title: manual.title,
      chunkCount,
    })
  } catch (e) {
    console.error("[POST /api/manuals/index-chunks]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "İndeksleme başarısız." },
      { status: 500 }
    )
  }
}
