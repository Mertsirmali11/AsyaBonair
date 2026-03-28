import "server-only"

import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

/**
 * Konuşma listesi için okunmamış sayılarını tek sorguda hesaplar (N+1 count yerine).
 */
export async function dmUnreadCountsByConversationIds(
  prisma: PrismaClient,
  calisanId: number,
  conversationIds: number[]
): Promise<Map<number, number>> {
  const out = new Map<number, number>()
  if (conversationIds.length === 0) return out

  const rows = await prisma.$queryRaw<{ conversation_id: number; cnt: bigint }[]>(Prisma.sql`
    SELECT m.conversation_id, COUNT(*)::bigint AS cnt
    FROM dm_messages m
    LEFT JOIN dm_read_states rs
      ON rs.conversation_id = m.conversation_id AND rs.calisan_id = ${calisanId}
    WHERE m.conversation_id IN (${Prisma.join(conversationIds)})
      AND m.sender_id <> ${calisanId}
      AND m.id > COALESCE(rs.last_read_message_id, 0)
    GROUP BY m.conversation_id
  `)

  for (const r of rows) {
    out.set(r.conversation_id, Number(r.cnt))
  }
  return out
}
