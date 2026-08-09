import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma-server"
import { assertCanManageShgmMevzuat } from "@/lib/shgm/access"
import { SHGM_CATEGORY_LABELS, type ShgmCategoryKey } from "@/lib/shgm/categories"
import { summarizeShgmRegulation } from "@/lib/shgm/summarize"
import { extractTextFromPdfBuffer } from "@/lib/extract-pdf-text"
import { downloadPdfFromStorage } from "@/lib/supabase-storage"

export const runtime = "nodejs"

/** Manuel "Özet oluştur / yenile" — detay sayfasındaki buton bunu çağırır. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertCanManageShgmMevzuat()
  if (!gate.ok) return gate.response

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const regulation = await prisma.shgmRegulation.findUnique({
    where: { id: numericId },
    include: { revisions: { orderBy: { detectedAt: "desc" }, take: 1 } },
  })
  if (!regulation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const latestPdfPath = regulation.revisions[0]?.pdfStoragePath ?? null

  let pdfText: string | null = null
  if (latestPdfPath) {
    const buffer = await downloadPdfFromStorage(latestPdfPath)
    if (buffer) {
      try {
        const extracted = await extractTextFromPdfBuffer(buffer)
        pdfText = extracted.text
      } catch (e) {
        console.error(`[shgm-summarize] extraction failed for ${numericId}:`, e)
      }
    }
  }

  const summary = await summarizeShgmRegulation({
    title: regulation.title,
    categoryLabel: SHGM_CATEGORY_LABELS[regulation.category as ShgmCategoryKey] ?? regulation.category,
    pdfText,
  })

  if (!summary) {
    return NextResponse.json(
      { error: "Özet oluşturulamadı (AI servisi yanıt vermedi veya yapılandırılmamış)." },
      { status: 502 }
    )
  }

  const updated = await prisma.shgmRegulation.update({
    where: { id: numericId },
    data: { aiSummary: summary, aiSummaryUpdatedAt: new Date() },
  })

  return NextResponse.json({
    aiSummary: updated.aiSummary,
    aiSummaryUpdatedAt: updated.aiSummaryUpdatedAt?.toISOString() ?? null,
  })
}
