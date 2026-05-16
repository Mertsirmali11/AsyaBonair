import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { indexManualChunks } from "@/lib/manual-chunk-indexer"
import { isAdminDepartment } from "@/lib/department-access"

/**
 * Tüm isCurrent=true manuelleri sırayla yeniden indexler.
 * Her manuel için Embedding API çağrısı yapılır — uzun sürebilir.
 */
export const maxDuration = 300

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

    const manuals = await prisma.companyManual.findMany({
      where: { isCurrent: true },
      select: { id: true, title: true, contentText: true },
      orderBy: { title: "asc" },
    })

    type ResultEntry = {
      manualId: number
      title: string
      chunkCount: number
      status: "ok" | "error"
      error?: string
    }

    const results: ResultEntry[] = []

    for (const manual of manuals) {
      try {
        const chunkCount = await indexManualChunks(manual.id, manual.contentText)
        results.push({ manualId: manual.id, title: manual.title, chunkCount, status: "ok" })
      } catch (e) {
        console.error(`[reindex-all] Manuel ${manual.id} ("${manual.title}") başarısız:`, e)
        results.push({
          manualId: manual.id,
          title: manual.title,
          chunkCount: 0,
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }

    const totalChunks = results.reduce((s, r) => s + r.chunkCount, 0)
    const errorCount = results.filter((r) => r.status === "error").length

    return NextResponse.json({
      total: manuals.length,
      totalChunks,
      errorCount,
      results,
    })
  } catch (e) {
    console.error("[POST /api/manuals/reindex-all]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Yeniden indexleme başarısız." },
      { status: 500 }
    )
  }
}
