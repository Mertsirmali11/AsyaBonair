import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { geminiChatCompletion, type GeminiChatMessage } from "@/lib/gemini-chat"
import { userFacingAiError } from "@/lib/ai-provider-errors"
import {
  composeManualSystemPrompt,
  type ManualForRag,
} from "@/lib/manual-rag-context"

const BASE_SYSTEM = `Sen Bonair Havacılık'ın yapay zeka asistanısın. Türk sivil havacılık mevzuatı (SHGM, SHY, SHT), uçuş operasyonları, SMS (Safety Management System) ve FDM (Flight Data Monitoring) konularında uzmansın. Kullanıcılara her zaman Türkçe yanıt verirsin. Bilmediğin veya doğrulayamadığın mevzuat maddelerini uydurmak yerine kullanıcıya resmi kaynağı kontrol etmesini söylersin.`

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

export async function POST(req: NextRequest) {
  try {
    // Auth zorunlu — AI endpoint'e sadece giriş yapmış kullanıcılar erişebilir
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 })
    }

    const body = (await req.json()) as Record<string, unknown> & {
      messages?: ChatMsg[]
    }
    const raw: ChatMsg[] = Array.isArray(body.messages) ? body.messages : []
    const messages = sanitizeChatMessages(raw)

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "Geçerli mesaj yok." },
        { status: 400 }
      )
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    const userQuery = lastUser?.content?.trim() ?? ""

    // Tüm isCurrent=true manuel revizyonlarını otomatik yükle.
    // Erişim kuralı: normal kullanıcılar zaten sadece isCurrent=true kayıtları görebilir
    // (admin ise arşivlenmiş kayıtlara da erişebilir — burada ikisi için de sadece güncel olanlar kullanılır).
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

    const manuals: ManualForRag[] = rows.map((r) => ({
      title: r.title,
      contentText: r.contentText ?? "",
      revision: r.revision,
      revisionDate: r.revisionDate ? r.revisionDate.toISOString().slice(0, 10) : null,
      manualNumber: r.manualNumber,
    }))

    const usedManuals: ManualMeta[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      manualNumber: r.manualNumber,
      revision: r.revision,
      revisionDate: r.revisionDate ? r.revisionDate.toISOString().slice(0, 10) : null,
    }))

    const system = composeManualSystemPrompt(BASE_SYSTEM, manuals, userQuery)

    const geminiMessages: GeminiChatMessage[] = [
      { role: "system", content: system },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ]

    const result = await geminiChatCompletion({
      messages: geminiMessages,
      maxTokens: manuals.length > 0 ? 4096 : 1024,
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
