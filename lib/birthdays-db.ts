import "server-only"

import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

export type BirthdayRow = {
  id: number
  isim: string | null
  soyisim: string | null
  departman: string | null
  dogumTarihi: Date | null
}

/**
 * PG `calisanlar` üzerinde ay/gün eşleşmesi — tüm tabloyu çekip JS ile filtrelemek yerine.
 */
export async function findCalisanlarWithBirthdayOnCalendarDay(
  prisma: PrismaClient,
  month: number,
  day: number
): Promise<BirthdayRow[]> {
  return prisma.$queryRaw<BirthdayRow[]>(Prisma.sql`
    SELECT id, isim, soyisim, departman, dogum_tarihi AS "dogumTarihi"
    FROM calisanlar
    WHERE dogum_tarihi IS NOT NULL
      AND EXTRACT(MONTH FROM dogum_tarihi::date) = ${month}
      AND EXTRACT(DAY FROM dogum_tarihi::date) = ${day}
  `)
}
