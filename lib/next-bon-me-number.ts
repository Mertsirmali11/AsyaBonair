import "server-only"

import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

/** `BON-ME-001` biçiminde bir sonraki numara (MAX+1; silinen numaralar yeniden kullanılmaz). */
export async function nextBonMeMeetingNumber(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ nextNo: number | bigint }>>(Prisma.sql`
    SELECT COALESCE(
      MAX((regexp_match(meeting_no, '^BON-ME-([0-9]+)$'))[1]::integer),
      0
    ) + 1 AS "nextNo"
    FROM meetings
    WHERE meeting_no ~ '^BON-ME-[0-9]+$'
  `)
  const n = rows[0]?.nextNo
  return typeof n === "bigint" ? Number(n) : Number(n ?? 1)
}
