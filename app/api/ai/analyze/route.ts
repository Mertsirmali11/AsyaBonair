import { NextRequest, NextResponse } from "next/server"
import { userFacingAnthropicError } from "@/lib/anthropic-user-errors"

export async function POST(req: NextRequest) {
  try {
    const key = process.env.ANTHROPIC_API_KEY?.trim()
    if (!key) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY tanımlı değil." },
        { status: 503 }
      )
    }

    const { text, analysisType } = await req.json()

    const prompts: Record<string, string> = {
      summary: `Aşağıdaki dokümanı havacılık operasyonları perspektifinden özetle. Önemli bulgular, aksiyon gerektiren maddeler ve risk noktalarını vurgula:\n\n${text}`,
      anomaly: `Aşağıdaki veriyi analiz et. Anomali, sapma veya güvenlik riski oluşturabilecek durumları tespit et ve önem sırasına göre listele:\n\n${text}`,
      report: `Aşağıdaki bilgileri kullanarak resmi bir havacılık uyum raporu oluştur. SHGM standartlarına uygun, profesyonel Türkçe dil kullan:\n\n${text}`,
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
        max_tokens: 2048,
        system: `Sen Bonair Havacılık'ın uzman AI asistanısın. Türk sivil havacılık mevzuatı (SHGM, SHY, SHT), SMS ve FDM konularında uzmansın. Yanıtlarını Türkçe ver.`,
        messages: [
          { role: "user", content: prompts[analysisType] || prompts.summary },
        ],
      }),
    })

    const data = (await response.json()) as {
      content?: Array<{ text?: string }>
      error?: { message?: string }
    }

    if (!response.ok) {
      const detail = data.error?.message || "AI servisi hatası."
      return NextResponse.json(
        { error: userFacingAnthropicError(detail) },
        { status: 502 }
      )
    }

    const textOut = data.content?.[0]?.text
    if (!textOut) {
      return NextResponse.json({ error: "Yanıt okunamadı." }, { status: 502 })
    }

    return NextResponse.json({ content: textOut })
  } catch {
    return NextResponse.json({ error: "Analiz yapılamadı." }, { status: 500 })
  }
}
