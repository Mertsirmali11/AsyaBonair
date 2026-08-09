import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma-server"
import { assertCanManageShgmMevzuat } from "@/lib/shgm/access"
import { SHGM_CATEGORY_LABELS, type ShgmCategoryKey } from "@/lib/shgm/categories"

export const dynamic = "force-dynamic"

const MAX_PREVIEW = 6

/** Başlıktaki SHGM zil göstergesi — "Yeni" durumundaki mevzuat sayısı + kısa önizleme. */
export async function GET() {
  const gate = await assertCanManageShgmMevzuat()
  if (!gate.ok) {
    // Yetkisiz kullanıcılar için sessizce boş dön — bileşen hiç göstermesin.
    return NextResponse.json({ count: 0, items: [] })
  }

  const [count, items] = await Promise.all([
    prisma.shgmRegulation.count({ where: { status: "new" } }),
    prisma.shgmRegulation.findMany({
      where: { status: "new" },
      orderBy: { updatedAt: "desc" },
      take: MAX_PREVIEW,
      select: { id: true, title: true, category: true },
    }),
  ])

  return NextResponse.json({
    count,
    items: items.map((r) => ({
      id: r.id,
      title: r.title,
      categoryLabel: SHGM_CATEGORY_LABELS[r.category as ShgmCategoryKey] ?? r.category,
    })),
  })
}
