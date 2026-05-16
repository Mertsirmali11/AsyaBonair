import "server-only"

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma-server"
import { getQueryEmbedding } from "@/lib/embedding"

/** Vektör aramasından dönen tek chunk satırı. */
export type ChunkResult = {
  id: number
  manualId: number
  chunkIndex: number
  chunkText: string
  title: string
  manualNumber: string | null
  revision: number
  revisionDate: Date | null
  similarity: number
}

/** Kaç chunk döneceği ve minimum benzerlik eşiği. */
const TOP_K = 8
const MIN_SIMILARITY = 0.3

/**
 * Kullanıcı sorgusunu embed'leyerek `manual_chunks` tablosunda cosine
 * similarity araması yapar. Yalnızca `company_manuals.is_current = true`
 * olan manuellerin chunk'ları döner.
 *
 * `manualId` verilirse yalnızca o manualin chunk'larında arar.
 * `MIN_SIMILARITY` altındaki sonuçlar filtrelenir.
 * Herhangi bir hata (API, DB) yakalanmaz — çağıran taraf try/catch kullanmalı.
 */
export async function searchManualChunks(
  userQuery: string,
  manualId?: number
): Promise<ChunkResult[]> {
  const queryEmbedding = await getQueryEmbedding(userQuery)

  // Vektörü SQL string literal'a çevir — sayısal değerler olduğu için güvenli
  const vectorLiteral = Prisma.raw(`'[${queryEmbedding.join(",")}]'::vector(768)`)
  const manualFilter = manualId
    ? Prisma.sql`AND mc.manual_id = ${manualId}`
    : Prisma.sql``

  const rows = await prisma.$queryRaw<
    {
      id: number
      manual_id: number
      chunk_index: number
      chunk_text: string
      title: string
      manual_number: string | null
      revision: number
      revision_date: Date | null
      similarity: number
    }[]
  >(
    Prisma.sql`
      SELECT
        mc.id::int,
        mc.manual_id::int,
        mc.chunk_index::int,
        mc.chunk_text,
        cm.title,
        cm.manual_number,
        cm.revision::int,
        cm.revision_date,
        (1 - (mc.embedding <=> ${vectorLiteral}))::float AS similarity
      FROM manual_chunks mc
      JOIN company_manuals cm
        ON cm.id = mc.manual_id
        AND cm.is_current = true
      WHERE mc.embedding IS NOT NULL
        ${manualFilter}
        AND (1 - (mc.embedding <=> ${vectorLiteral})) > ${MIN_SIMILARITY}
      ORDER BY mc.embedding <=> ${vectorLiteral}
      LIMIT ${TOP_K}
    `
  )

  return rows.map((r) => ({
    id: r.id,
    manualId: r.manual_id,
    chunkIndex: r.chunk_index,
    chunkText: r.chunk_text,
    title: r.title,
    manualNumber: r.manual_number,
    revision: r.revision,
    revisionDate: r.revision_date,
    similarity: r.similarity,
  }))
}
