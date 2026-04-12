import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { isAdminDepartment } from "@/lib/department-access"
import { geminiChatCompletion, type GeminiChatMessage } from "@/lib/gemini-chat"
import { userFacingAiError } from "@/lib/ai-provider-errors"
import {
  composeManualSystemPrompt,
  type ManualForRag,
} from "@/lib/manual-rag-context"

const BASE_SYSTEM = `Sen Bonair Havacılık'ın yapay zeka asistanısın. Türk sivil havacılık mevzuatı (SHGM, SHY, SHT), uçuş operasyonları, SMS (Safety Management System) ve FDM (Flight Data Monitoring) konularında uzmansın. Kullanıcılara her zaman Türkçe yanıt verirsin. Bilmediğin veya doğrulayamadığın mevzuat maddelerini uydurmak yerine kullanıcıya resmi kaynağı kontrol etmesini söylersin.`

const MAX_MANUALS_PER_CHAT = 15

type ChatMsg = { role: string; content: string }

function parseManualIds(body: Record<string, unknown>): number[] {
  const raw = body.manualIds
  if (Array.isArray(raw)) {
    const ids: number[] = []
    for (const x of raw) {
      const n =
        typeof x === "number" ? x : Number.parseInt(String(x), 10)
      if (!Number.isNaN(n)) ids.push(n)
    }
    return [...new Set(ids)]
  }
  const single = body.manualId
  if (single != null && single !== "") {
    const n =
      typeof single === "number"
        ? single
        : Number.parseInt(String(single), 10)
    if (!Number.isNaN(n)) return [n]
  }
  return []
}

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

    let manuals: ManualForRag[] = []
    const rawIds = parseManualIds(body)
    if (rawIds.length > MAX_MANUALS_PER_CHAT) {
      return NextResponse.json(
        { error: `En fazla ${MAX_MANUALS_PER_CHAT} manuel seçilebilir.` },
        { status: 400 }
      )
    }
    const ids = rawIds

    if (ids.length > 0) {
      const session = await auth()
      const rows = await prisma.companyManual.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          title: true,
          contentText: true,
          isCurrent: true,
        },
      })
      if (rows.length !== ids.length) {
        return NextResponse.json(
          { error: "Bir veya daha fazla manuel bulunamadı." },
          { status: 404 }
        )
      }
      for (const row of rows) {
        if (
          !row.isCurrent &&
          !isAdminDepartment(session?.user?.departman)
        ) {
          return NextResponse.json({ error: "Manuel bulunamadı." }, { status: 404 })
        }
      }
      const order = new Map(ids.map((id, i) => [id, i]))
      manuals = [...rows]
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
        .map((r) => ({ title: r.title, contentText: r.contentText }))
    }

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

    return NextResponse.json({ content: result.text })
  } catch (e) {
    console.error("[api/ai/chat]", e)
    return NextResponse.json({ error: "Bağlantı hatası." }, { status: 500 })
  }
}
