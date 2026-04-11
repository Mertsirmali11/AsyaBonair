import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { assertCanManageAnnouncements } from "@/lib/announcements-access"

/**
 * Güncel manuel satırını arşivler (isCurrent: false).
 * Seride birden fazla kayıt varsa: kalanlar arasında en yüksek revizyon tekrar güncel olur.
 * Seride tek kayıt varsa: yalnızca arşivlenir (seride güncel kalmaz; AI seçicisinde görünmez).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertCanManageAnnouncements()
  if (!gate.ok) return gate.response

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const row = await tx.companyManual.findUnique({
        where: { id: numericId },
        select: { id: true, seriesId: true, isCurrent: true },
      })
      if (!row) return { ok: false as const, code: "NOT_FOUND" as const }
      if (!row.isCurrent) return { ok: false as const, code: "NOT_CURRENT" as const }

      const cnt = await tx.companyManual.count({
        where: { seriesId: row.seriesId },
      })

      if (cnt < 2) {
        await tx.companyManual.update({
          where: { id: row.id },
          data: { isCurrent: false },
        })
        return { ok: true as const }
      }

      const successor = await tx.companyManual.findFirst({
        where: { seriesId: row.seriesId, id: { not: row.id } },
        orderBy: { revision: "desc" },
        select: { id: true },
      })
      if (!successor) {
        return { ok: false as const, code: "NO_SUCCESSOR" as const }
      }

      await tx.companyManual.updateMany({
        where: { seriesId: row.seriesId },
        data: { isCurrent: false },
      })
      await tx.companyManual.update({
        where: { id: successor.id },
        data: { isCurrent: true },
      })
      return { ok: true as const }
    })

    if (!outcome.ok) {
      if (outcome.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
      if (outcome.code === "NOT_CURRENT") {
        return NextResponse.json(
          { error: "Bu satır güncel değil; yalnızca güncel revizyon arşivlenebilir." },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: "Arşivlenemedi." }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error("archive-current manual:", e)
    return NextResponse.json({ error: "Arşivlenemedi." }, { status: 500 })
  }
}
