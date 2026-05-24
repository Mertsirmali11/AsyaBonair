import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { rateLimit } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma-server"
import { geminiChatCompletion, type GeminiChatMessage } from "@/lib/groq-chat"
import { userFacingAiError } from "@/lib/ai-provider-errors"
import {
  composeManualSystemPrompt,
  type ManualForRag,
} from "@/lib/manual-rag-context"
import {
  searchManualChunks,
  type ChunkResult,
} from "@/lib/manual-vector-search"

const BASE_SYSTEM_TR = `Sen Bonair Havacılık'ın yapay zeka asistanısın. Türk sivil havacılık mevzuatı (SHGM, SHY, SHT), uçuş operasyonları, SMS (Safety Management System) ve FDM (Flight Data Monitoring) konularında uzmansın. Yanıtlarını Türkçe ver. Manuellerde ilgili bilgi bulamazsan genel havacılık bilgin ile yanıt ver ve kaynağın manuel değil genel bilgi olduğunu belirt. Bilmediğin mevzuat maddelerini uydurma.`

const BASE_SYSTEM_EN = `You are the AI assistant for Bonair Aviation. You are an expert in Turkish civil aviation regulations (SHGM, SHY, SHT), flight operations, SMS (Safety Management System) and FDM (Flight Data Monitoring). Always respond in English. If the loaded manuals do not contain specific information about a topic, answer from your general aviation expertise and note that the answer is based on general knowledge rather than the loaded manuals. Do not invent regulatory details you cannot verify.`

/** Tüm güncel manuel revizyonları için DB'den yüklenecek maksimum kayıt sayısı. */
const MAX_AUTO_MANUALS = 60

export type ManualMeta = {
  id: number
  title: string
  manualNumber: string | null
  revision: number
  revisionDate: string | null
}

type ChatMsg = { role: string; content: string }

/**
 * İstemci ilk karşılama metnini assistant olarak gönderdiği için baştaki assistant
 * mesajlarını atıyoruz (karşılama zaten system prompt'ta özetleniyor).
 */
function sanitizeChatMessages(messages: ChatMsg[]): ChatMsg[] {
  const filtered = messages.filter(
    (m) => m.role === "user" || m.role === "assistant"
  )
  let start = 0
  while (start < filtered.length && filtered[start].role === "assistant") {
    start++
  }
  return filtered.slice(start)
}

/** Manuel görüntüleme başlığı: "OM-A Rev.2" */
function chunkManualDisplayTitle(c: ChunkResult): string {
  const parts: string[] = [c.title]
  if (c.manualNumber) parts.push(`(${c.manualNumber})`)
  parts.push(`Rev.${c.revision}`)
  return parts.join(" ")
}

/**
 * Vektör arama sonuçlarından system prompt oluşturur.
 * Chunk'lar manuellerine göre gruplanarak "--- Başlık ---\nmetin" formatında eklenir.
 */
function buildVectorSystemPrompt(
  baseSystem: string,
  chunks: ChunkResult[],
  locale: "tr" | "en" = "tr"
): string {
  // Manuel bazında grupla (insertion-order korunur — zaten similarity'ye göre sıralı)
  const manualMap = new Map<
    number,
    { displayTitle: string; texts: string[] }
  >()
  for (const chunk of chunks) {
    if (!manualMap.has(chunk.manualId)) {
      manualMap.set(chunk.manualId, {
        displayTitle: chunkManualDisplayTitle(chunk),
        texts: [],
      })
    }
    manualMap.get(chunk.manualId)!.texts.push(chunk.chunkText)
  }

  const blocks: string[] = []
  for (const [, entry] of manualMap) {
    blocks.push(`--- ${entry.displayTitle} ---\n${entry.texts.join("\n\n")}`)
  }

  const contextBlock = blocks.join("\n\n")

  if (locale === "en") {
    return `${baseSystem}
---
SYSTEM MANUALS — SEMANTIC SEARCH RESULTS (top ${chunks.length} most relevant segment(s)):

Rules:
- Prioritize information from the text segments below.
- Cite the source in square brackets: [Manual Name - Rev.X] or [Manual Name].
- If the segments do not cover a topic, answer from your general aviation expertise and note it as [General Knowledge].
- Do not invent specific regulatory article numbers or procedures you cannot verify.
- End your response with a brief "Sources:" line.

--- SEMANTIC SEARCH RESULTS ---
${contextBlock}`
  }

  return `${baseSystem}
---
SİSTEM MANUELLERİ — SEMANTİK ARAMA SONUÇLARI (en ilgili ${chunks.length} parça):

Kurallar:
- Öncelikli olarak aşağıdaki metin parçalarını kullan.
- Her bilgi için köşeli parantez içinde kaynağı belirt: [Manuel Adı - Rev.X] veya [Manuel Adı].
- Parçalarda konu hakkında bilgi yoksa genel havacılık bilginle yanıt ver ve bunu [Genel Bilgi] olarak işaretle.
- Doğrulayamadığın mevzuat maddelerini veya prosedür numaralarını uydurma.
- Yanıtın sonunda kısa bir "Kaynak:" satırı ekle.

--- SEMANTİK ARAMA SONUÇLARI ---
${contextBlock}`
}

export async function POST(req: NextRequest) {
  try {
    // Auth zorunlu — AI endpoint'e sadece giriş yapmış kullanıcılar erişebilir
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 })
    }

    // Rate limiting: kullanıcı başına dakikada 20 istek
    const rl = rateLimit(`ai:chat:${session.user.email}`, 20, 60_000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Çok fazla istek gönderildi. Lütfen bir dakika bekleyin." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
        }
      )
    }

    const body = (await req.json()) as Record<string, unknown> & {
      messages?: ChatMsg[]
      manualId?: number
      locale?: string
    }
    const raw: ChatMsg[] = Array.isArray(body.messages) ? body.messages : []
    const messages = sanitizeChatMessages(raw)
    const filterManualId =
      typeof body.manualId === "number" && body.manualId > 0
        ? body.manualId
        : undefined
    const locale: "tr" | "en" = body.locale === "en" ? "en" : "tr"
    const BASE_SYSTEM = locale === "en" ? BASE_SYSTEM_EN : BASE_SYSTEM_TR

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "Geçerli mesaj yok." },
        { status: 400 }
      )
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    const userQuery = lastUser?.content?.trim() ?? ""

    // ─── Tüm güncel manuelleri yükle (keyword fallback için de gerekli) ──────
    const rows = await prisma.companyManual.findMany({
      where: { isCurrent: true },
      select: {
        id: true,
        title: true,
        contentText: true,
        revision: true,
        revisionDate: true,
        manualNumber: true,
      },
      orderBy: { title: "asc" },
      take: MAX_AUTO_MANUALS,
    })

    const allManualsMeta: ManualMeta[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      manualNumber: r.manualNumber,
      revision: r.revision,
      revisionDate: r.revisionDate ? r.revisionDate.toISOString().slice(0, 10) : null,
    }))

    // ─── Vektör arama (pgvector) ──────────────────────────────────────────────
    let system: string
    let usedManuals: ManualMeta[]

    if (userQuery) {
      try {
        const chunks = await searchManualChunks(userQuery, filterManualId)

        if (chunks.length > 0) {
          // Vektör arama başarılı — chunk tabanlı prompt kullan
          system = buildVectorSystemPrompt(BASE_SYSTEM, chunks, locale)

          // Kullanılan manuelleri meta listesinden eşleştir
          const usedIds = new Set(chunks.map((c) => c.manualId))
          usedManuals = allManualsMeta.filter((m) => usedIds.has(m.id))
        } else {
          // Chunk indexi boş / benzerlik eşiği geçilmedi → keyword fallback
          console.info("[api/ai/chat] Vector search returned 0 chunks, falling back to keyword RAG")
          const manuals: ManualForRag[] = rows.map((r) => ({
            title: r.title,
            contentText: r.contentText ?? "",
            revision: r.revision,
            revisionDate: r.revisionDate ? r.revisionDate.toISOString().slice(0, 10) : null,
            manualNumber: r.manualNumber,
          }))
          system = composeManualSystemPrompt(BASE_SYSTEM, manuals, userQuery, locale)
          usedManuals = allManualsMeta
        }
      } catch (vectorErr) {
        // Vektör arama hatası (API key yok, pgvector extension yok vb.) → keyword fallback
        console.warn("[api/ai/chat] Vector search failed, falling back to keyword RAG:", vectorErr)
        const manuals: ManualForRag[] = rows.map((r) => ({
          title: r.title,
          contentText: r.contentText ?? "",
          revision: r.revision,
          revisionDate: r.revisionDate ? r.revisionDate.toISOString().slice(0, 10) : null,
          manualNumber: r.manualNumber,
        }))
        system = composeManualSystemPrompt(BASE_SYSTEM, manuals, userQuery, locale)
        usedManuals = allManualsMeta
      }
    } else {
      // Sorgu boş → keyword fallback
      const manuals: ManualForRag[] = rows.map((r) => ({
        title: r.title,
        contentText: r.contentText ?? "",
        revision: r.revision,
        revisionDate: r.revisionDate ? r.revisionDate.toISOString().slice(0, 10) : null,
        manualNumber: r.manualNumber,
      }))
      system = composeManualSystemPrompt(BASE_SYSTEM, manuals, userQuery, locale)
      usedManuals = allManualsMeta
    }

    const geminiMessages: GeminiChatMessage[] = [
      { role: "system", content: system },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ]

    const result = await geminiChatCompletion({
      messages: geminiMessages,
      maxTokens: rows.length > 0 ? 4096 : 1024,
    })

    if (!result.ok) {
      if (result.status === 503) {
        return NextResponse.json({ error: result.detail }, { status: 503 })
      }
      if (result.status === 429) {
        return NextResponse.json(
          { error: userFacingAiError(result.detail) },
          { status: 429 }
        )
      }
      console.error("[api/ai/chat] Gemini error:", result.status, result.detail)
      const friendly = userFacingAiError(result.detail)
      return NextResponse.json({ error: friendly }, { status: 502 })
    }

    return NextResponse.json({ content: result.text, usedManuals })
  } catch (e) {
    console.error("[api/ai/chat]", e)
    return NextResponse.json({ error: "Bağlantı hatası." }, { status: 500 })
  }
}
