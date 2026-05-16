import "server-only"

import { prisma } from "@/lib/prisma-server"
import { getEmbedding } from "@/lib/embedding"

/**
 * Chunk parametreleri — kelime sınırı gözetilmez (hız için basit karakter kesimi).
 * 200 karakterlik overlap bağlam devamlılığını korur.
 */
const CHUNK_SIZE = 1_000
const CHUNK_OVERLAP = 200

/** contentText'i CHUNK_SIZE/CHUNK_OVERLAP ile örtüşen parçalara böler. */
function splitIntoChunks(text: string): string[] {
  const t = text.trim()
  if (!t) return []

  const chunks: string[] = []
  let start = 0

  while (start < t.length) {
    const end = Math.min(start + CHUNK_SIZE, t.length)
    const chunk = t.slice(start, end).trim()
    if (chunk.length > 0) chunks.push(chunk)
    if (end >= t.length) break
    start = end - CHUNK_OVERLAP
  }

  return chunks
}

/**
 * Tek bir manuel için chunk'ları oluşturup embedding'lerini hesaplar ve
 * `manual_chunks` tablosuna yazar. Önceki chunk'lar önce silinir.
 *
 * @returns Oluşturulan chunk sayısı
 */
export async function indexManualChunks(
  manualId: number,
  contentText: string
): Promise<number> {
  // Eski chunk'ları sil — Prisma delegate çalışır (embedding alanına dokunmadan)
  await prisma.manualChunk.deleteMany({ where: { manualId } })

  const chunks = splitIntoChunks(contentText)
  if (chunks.length === 0) return 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const embedding = await getEmbedding(chunk)

    // vector(768) Unsupported type — $executeRaw ile doğrudan yaz
    const vectorLiteral = `[${embedding.join(",")}]`

    await prisma.$executeRaw`
      INSERT INTO manual_chunks (manual_id, chunk_index, chunk_text, embedding, created_at)
      VALUES (
        ${manualId},
        ${i},
        ${chunk},
        ${vectorLiteral}::vector(768),
        NOW()
      )
    `
  }

  return chunks.length
}
