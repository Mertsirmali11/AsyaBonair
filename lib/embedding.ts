import "server-only"

/**
 * Google text-embedding-004 API wrapper.
 * 768 boyutlu vektör döndürür.
 * Döküman embed'i için RETRIEVAL_DOCUMENT, sorgu için RETRIEVAL_QUERY task type kullanılır.
 */

const EMBEDDING_MODEL = "models/text-embedding-004"
const EMBEDDING_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta"

/** Tek bir embed isteğinde gönderilecek maksimum karakter sayısı. */
const MAX_TEXT_CHARS = 8_000

function resolveApiKey(): string {
  const k =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
  if (!k) {
    throw new Error(
      "GEMINI_API_KEY tanımlı değil. .env.local'a GEMINI_API_KEY ekleyin."
    )
  }
  return k
}

async function fetchEmbedding(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"
): Promise<number[]> {
  const key = resolveApiKey()
  const truncated = text.slice(0, MAX_TEXT_CHARS)

  const url = `${EMBEDDING_API_BASE}/${EMBEDDING_MODEL}:embedContent?key=${key}`

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      content: { parts: [{ text: truncated }] },
      taskType,
    }),
  })

  if (!resp.ok) {
    const body = await resp.text().catch(() => "(okunamadı)")
    throw new Error(
      `Embedding API ${resp.status}: ${body.slice(0, 300)}`
    )
  }

  const data = (await resp.json()) as {
    embedding?: { values?: number[] }
  }
  const values = data.embedding?.values
  if (!values || values.length === 0) {
    throw new Error("Embedding API boş vektör döndürdü.")
  }
  return values
}

/**
 * Döküman embedding'i — kaynak metin için RETRIEVAL_DOCUMENT task type.
 * Manuel chunk'larını indexlerken kullan.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  return fetchEmbedding(text, "RETRIEVAL_DOCUMENT")
}

/**
 * Sorgu embedding'i — kullanıcı sorusu için RETRIEVAL_QUERY task type.
 * Benzerlik araması yaparken kullan.
 */
export async function getQueryEmbedding(text: string): Promise<number[]> {
  return fetchEmbedding(text, "RETRIEVAL_QUERY")
}
