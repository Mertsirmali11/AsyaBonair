import "server-only"

/** Şirket manuelinden sohbet bağlamı: uzun PDF metinlerinde soruya göre parça seçimi (embedding yok). */
export type ManualForRag = { title: string; contentText: string }

const SHORT_DOC_THRESHOLD = 8_000
const MAX_COMBINED_CONTEXT_CHARS = 14_000
const CHUNK_SIZE = 2_800
const CHUNK_STEP = 2_200

const STOP = new Set([
  "ve",
  "veya",
  "ile",
  "için",
  "bir",
  "bu",
  "şu",
  "da",
  "de",
  "mi",
  "mı",
  "mu",
  "mü",
  "the",
  "and",
  "or",
  "for",
  "not",
  "are",
  "was",
  "has",
  "have",
])

function normalizeQueryTokens(query: string): string[] {
  const q = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
  const raw = q.split(/[^a-z0-9ğüşıöçĞÜŞİÖÇ]+/u).filter(Boolean)
  const out: string[] = []
  for (const w of raw) {
    if (w.length < 2) continue
    if (STOP.has(w)) continue
    out.push(w)
  }
  return [...new Set(out)]
}

function chunkText(text: string): string[] {
  const t = text.trim()
  if (!t) return []
  const chunks: string[] = []
  for (let i = 0; i < t.length; i += CHUNK_STEP) {
    chunks.push(t.slice(i, i + CHUNK_SIZE))
    if (i + CHUNK_SIZE >= t.length) break
  }
  return chunks
}

function scoreChunk(chunk: string, tokens: string[]): number {
  if (tokens.length === 0) return 0
  const lower = chunk.toLowerCase()
  let s = 0
  for (const tok of tokens) {
    if (lower.includes(tok)) s += 1
  }
  return s
}

function formatManualBlock(title: string, body: string): string {
  return `--- ${title} ---\n${body.trim()}`
}

type ChunkItem = {
  manualTitle: string
  text: string
  score: number
  ord: number
}

/**
 * Birden fazla veya çok uzun dokümanda: soru metnine göre en ilgili parçaları toplar.
 * Sorgu boş veya eşleşme yoksa her dokümanın başından orantılı alır.
 */
export function buildManualContextForChat(
  manuals: ManualForRag[],
  userQuery: string
): { contextBlock: string; usedRag: boolean; truncatedNote: string | null } {
  if (manuals.length === 0) {
    return { contextBlock: "", usedRag: false, truncatedNote: null }
  }

  const q = userQuery.trim()
  const tokens = normalizeQueryTokens(q)

  if (manuals.length === 1 && manuals[0].contentText.length <= SHORT_DOC_THRESHOLD) {
    const body = manuals[0].contentText.slice(0, MAX_COMBINED_CONTEXT_CHARS)
    const truncated =
      manuals[0].contentText.length > MAX_COMBINED_CONTEXT_CHARS
        ? `Metin ${MAX_COMBINED_CONTEXT_CHARS.toLocaleString("tr-TR")} karakterde kesildi.`
        : null
    return {
      contextBlock: formatManualBlock(manuals[0].title, body),
      usedRag: false,
      truncatedNote: truncated,
    }
  }

  if (tokens.length === 0) {
    const per = Math.max(
      1_500,
      Math.floor(MAX_COMBINED_CONTEXT_CHARS / manuals.length)
    )
    const parts: string[] = []
    for (const m of manuals) {
      const head = m.contentText.slice(0, per)
      if (head.trim()) parts.push(formatManualBlock(m.title, head))
    }
    return {
      contextBlock: parts.join("\n\n"),
      usedRag: true,
      truncatedNote:
        "Sorguda aranabilir kelime yok; her dokümanın başından eşit pay alındı. Daha iyi sonuç için somut terimler kullanın.",
    }
  }

  const items: ChunkItem[] = []
  let ord = 0
  for (const m of manuals) {
    const full = m.contentText
    if (!full.trim()) continue
    const chunks = chunkText(full)
    for (const ch of chunks) {
      items.push({
        manualTitle: m.title,
        text: ch,
        score: scoreChunk(ch, tokens),
        ord: ord++,
      })
    }
  }

  if (items.length === 0) {
    return {
      contextBlock: "",
      usedRag: true,
      truncatedNote: "Seçili manuel metinleri boş.",
    }
  }

  const hasPositive = items.some((i) => i.score > 0)
  items.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.ord - b.ord
  })

  const parts: string[] = []
  let total = 0
  const usedOrd = new Set<number>()

  for (const it of items) {
    if (hasPositive && it.score === 0) continue
    if (total >= MAX_COMBINED_CONTEXT_CHARS) break
    if (usedOrd.has(it.ord)) continue
    usedOrd.add(it.ord)
    const block = formatManualBlock(it.manualTitle, it.text)
    const remaining = MAX_COMBINED_CONTEXT_CHARS - total
    if (block.length <= remaining) {
      parts.push(block)
      total += block.length
    } else if (remaining > 400) {
      parts.push(
        formatManualBlock(it.manualTitle, it.text.slice(0, Math.max(0, remaining - 120)))
      )
      total = MAX_COMBINED_CONTEXT_CHARS
      break
    }
  }

  if (total === 0) {
    const per = Math.max(
      1_500,
      Math.floor(MAX_COMBINED_CONTEXT_CHARS / manuals.length)
    )
    for (const m of manuals) {
      const head = m.contentText.slice(0, per)
      if (head.trim()) parts.push(formatManualBlock(m.title, head))
    }
  }

  const combined = parts.join("\n\n")
  const truncatedNote =
    manuals.some((m) => m.contentText.length > SHORT_DOC_THRESHOLD) ||
    combined.length >= MAX_COMBINED_CONTEXT_CHARS - 200
      ? "Uzun dokümanlarda bağlam, soru ile kelime eşleşmesine göre en ilgili parçalarla sınırlandı; tam metin gönderilmez."
      : null

  return {
    contextBlock: combined,
    usedRag: true,
    truncatedNote,
  }
}

export function composeManualSystemPrompt(
  baseSystem: string,
  manuals: ManualForRag[],
  userQuery: string
): string {
  if (manuals.length === 0) return baseSystem

  const { contextBlock, usedRag, truncatedNote } = buildManualContextForChat(
    manuals,
    userQuery
  )
  const titles = manuals.map((m) => m.title).join(", ")
  const ragLine = usedRag
    ? "\n\nNot: Uzun veya birden fazla dokümanda yalnızca soruya en yakın metin parçaları (veya eşleşme yoksa her dokümanın başı) kullanılır."
    : ""
  const truncLine = truncatedNote ? `\n\nUyarı: ${truncatedNote}` : ""

  return `${baseSystem}
---
KULLANICI SEÇTİĞİ MANUEL(LER): ${titles}
${ragLine}${truncLine}

Kurallar:
- Yanıtı mümkün olduğunca yalnızca aşağıdaki metin parçalarına dayandır.
- Birden fazla manuel seçildiyse hepsini dikkate al; çelişki varsa açıkça belirt.
- Parçalarda veya manuelde geçmeyen bilgiyi uydurma; gerekirse "Seçili metinlerde yer almıyor" de.

--- SEÇİLİ DOKÜMANLARDAN GELEN METİN ---
${contextBlock}`
}
