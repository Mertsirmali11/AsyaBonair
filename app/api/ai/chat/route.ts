import { NextRequest, NextResponse } from "next/server"
import { userFacingAnthropicError } from "@/lib/anthropic-user-errors"

type ChatMsg = { role: string; content: string }

/**
 * Anthropic Messages API: konuşma kullanıcı mesajı ile başlamalı.
 * İstemci ilk karşılama metnini assistant olarak gönderdiği için baştaki assistant
 * mesajlarını atıyoruz (karşılama zaten system prompt’ta özetleniyor).
 */
function sanitizeAnthropicMessages(messages: ChatMsg[]): ChatMsg[] {
  const filtered = messages.filter(
    (m) => m.role === "user" || m.role === "assistant"
  )
  let start = 0
  while (start < filtered.length && filtered[start].role === "assistant") {
    start++
  }
  return filtered.slice(start)
}

function extractAnthropicText(data: { content?: Array<{ type?: string; text?: string }> }): string | null {
  const block = data.content?.[0]
  if (!block) return null
  if (block.type === "text" && typeof block.text === "string") return block.text
  if (typeof (block as { text?: string }).text === "string")
    return (block as { text: string }).text
  return null
}

export async function POST(req: NextRequest) {
  try {
    const key = process.env.ANTHROPIC_API_KEY?.trim()
    if (!key) {
      return NextResponse.json(
        {
          error:
            "ANTHROPIC_API_KEY tanımlı değil. .env.local dosyasına ekleyip sunucuyu yeniden başlatın.",
        },
        { status: 503 }
      )
    }

    const body = await req.json()
    const raw: ChatMsg[] = Array.isArray(body.messages) ? body.messages : []
    const messages = sanitizeAnthropicMessages(raw)

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "Geçerli mesaj yok." },
        { status: 400 }
      )
    }

    const model =
      process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514"

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: `Sen Bonair Havacılık'ın yapay zeka asistanısın. Türk sivil havacılık mevzuatı (SHGM, SHY, SHT), uçuş operasyonları, SMS (Safety Management System) ve FDM (Flight Data Monitoring) konularında uzmansın. Kullanıcılara her zaman Türkçe yanıt verirsin. Bilmediğin veya doğrulayamadığın mevzuat maddelerini uydurmak yerine kullanıcıya resmi kaynağı kontrol etmesini söylersin.`,
        messages: messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      }),
    })

    const data = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>
      error?: { message?: string; type?: string }
    }

    if (!response.ok) {
      const detail =
        data.error?.message ||
        (typeof data === "object" ? JSON.stringify(data).slice(0, 200) : "")
      console.error("[api/ai/chat] Anthropic error:", response.status, detail)
      const friendly = detail
        ? userFacingAnthropicError(detail)
        : "AI servisi yanıt veremedi. Model adı ve API anahtarını kontrol edin."
      return NextResponse.json({ error: friendly }, { status: 502 })
    }

    const text = extractAnthropicText(data)
    if (!text) {
      return NextResponse.json(
        { error: "Yanıt metni okunamadı." },
        { status: 502 }
      )
    }

    return NextResponse.json({ content: text })
  } catch (e) {
    console.error("[api/ai/chat]", e)
    return NextResponse.json({ error: "Bağlantı hatası." }, { status: 500 })
  }
}
