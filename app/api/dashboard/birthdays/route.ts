import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"

export async function GET() {
  const today = new Date()
  const month = today.getMonth() + 1
  const day = today.getDate()

  const calisanlar = await prisma.calisan.findMany({
    where: {
      dogumTarihi: { not: null },
    },
    select: {
      id: true,
      isim: true,
      soyisim: true,
      departman: true,
      dogumTarihi: true,
    },
  })

  const birthdays = calisanlar.filter(c => {
    if (!c.dogumTarihi) return false
    const d = new Date(c.dogumTarihi)
    return d.getMonth() + 1 === month && d.getDate() === day
  })

  return NextResponse.json(birthdays)
}
