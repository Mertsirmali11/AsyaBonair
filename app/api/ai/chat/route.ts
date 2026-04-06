import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { groqChatCompletion, type GroqChatMessage } from "@/lib/groq-chat"
import { userFacingGroqError } from "@/lib/groq-user-errors"
import { GROQ_MANUAL_CONTEXT_MAX_CHARS } from "@/lib/groq-truncate"

const MANUAL_CONTEXT_MAX_CHARS = GROQ_MANUAL_CONTEXT_MAX_CHARS

const BASE_SYSTEM = `Sen Bonair Havacılık'ın yapay zeka asistanısın. Türk sivil havacılık mevzuatı (SHGM, SHY, SHT), uçuş operasyonları, SMS (Safety Management System) ve FDM (Flight Data Monitoring) konularında uzmansın. Kullanıcılara her zaman Türkçe yanıt verirsin. Bilmediğin veya doğrulayamadığın mevzuat maddelerini uydurmak yerine kullanıcıya resmi kaynağı kontrol etmesini söylersin.`

function buildSystemWithOptionalManual(
  manual: { title: string; contentText: string } | null
): string {
  if (!manual) return BASE_SYSTEM
  const body = manual.contentText.slice(0, MANUAL_CONTEXT_MAX_CHARS)
  return `${BASE_SYSTEM}

---
KULLANICI AŞAĞIDAKİ ŞİRKET MANUELİNİ SEÇTİ — ÖNCELİK BU METİNDİR.
Manuel başlığı: ${manual.title}

Kurallar:
- Soruyu mümkün olduğunca yalnızca bu manuelin metnine dayanarak yanıtla.
- Metinde geçmeyen veya emin olmadığın bir şeyi uydurma; "Bu manuelde yer almıyor" veya "İlgili bölüm bulunamadı" de.
- Mümkünse manuelden kısa alıntı veya bölüm/madde ifadesiyle destekle.
- Genel bilgi ekleme; sadece manueldeki ifadeyi açıklamak gerekiyorsa kısa bağlam ver.

--- MANUEL METNİ ---
${body}`
}

type ChatMsg = { role: string; content: string }

/**
 * İstemci ilk karşılama metnini assistant olarak gönderdiği için baştaki assistant
 * mesajlarını atıyoruz (karşılama zaten system prompt’ta özetleniyor).
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      messages?: ChatMsg[]
      manualId?: number | string | null
    }
    const raw: ChatMsg[] = Array.isArray(body.messages) ? body.messages : []
    const messages = sanitizeChatMessages(raw)

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "Geçerli mesaj yok." },
        { status: 400 }
      )
    }

    let manual: { title: string; contentText: string } | null = null
    const mid = body.manualId
    if (mid != null && mid !== "") {
      const id =
        typeof mid === "number"
          ? mid
          : Number.parseInt(String(mid), 10)
      if (!Number.isNaN(id)) {
        const row = await prisma.companyManual.findUnique({
          where: { id },
          select: { title: true, contentText: true },
        })
        if (!row) {
          return NextResponse.json({ error: "Manuel bulunamadı." }, { status: 404 })
        }
        manual = row
      }
    }

    const system = buildSystemWithOptionalManual(manual)

    const groqMessages: GroqChatMessage[] = [
      { role: "system", content: system },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ]

    const result = await groqChatCompletion({
      messages: groqMessages,
      maxTokens: manual ? 4096 : 1024,
    })

    if (!result.ok) {
      if (result.status === 503) {
        return NextResponse.json({ error: result.detail }, { status: 503 })
      }
      console.error("[api/ai/chat] Groq error:", result.status, result.detail)
      const friendly = userFacingGroqError(result.detail)
      return NextResponse.json({ error: friendly }, { status: 502 })
    }

    return NextResponse.json({ content: result.text })
  } catch (e) {
    console.error("[api/ai/chat]", e)
    return NextResponse.json({ error: "Bağlantı hatası." }, { status: 500 })
  }
}
