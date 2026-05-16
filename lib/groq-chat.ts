import "server-only"

import Groq from "groq-sdk"

export type GeminiChatRole = "system" | "user" | "assistant"
export type GeminiChatMessage = { role: GeminiChatRole; content: string }

function resolveApiKey(): string | null {
  const k = process.env.GROQ_API_KEY?.trim()
  return k && k.length > 0 ? k : null
}

function defaultModel(): string {
  return process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile"
}

function isRateLimitError(e: unknown): boolean {
  if (e instanceof Error) {
    const lower = e.message.toLowerCase()
    return (
      lower.includes("rate limit") ||
      lower.includes("429") ||
      lower.includes("too many requests") ||
      lower.includes("quota")
    )
  }
  return false
}

/**
 * Groq API ile sohbet tamamlama.
 * `geminiChatCompletion` ile aynı imzayı paylaşır — drop-in replacement.
 */
export async function geminiChatCompletion(input: {
  messages: GeminiChatMessage[]
  maxTokens: number
  temperature?: number
}): Promise<
  { ok: true; text: string } | { ok: false; status: number; detail: string }
> {
  const key = resolveApiKey()
  if (!key) {
    return {
      ok: false,
      status: 503,
      detail:
        "GROQ_API_KEY tanımlı değil. https://console.groq.com/keys adresinden anahtar oluşturup .env.local'a ekleyin ve sunucuyu yeniden başlatın.",
    }
  }

  const client = new Groq({ apiKey: key })
  const model = defaultModel()

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: input.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: input.maxTokens,
      temperature: input.temperature ?? 0.6,
    })

    const text = completion.choices[0]?.message?.content?.trim()
    if (!text) {
      return { ok: false, status: 502, detail: "Yanıt metni boş." }
    }
    return { ok: true, text }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    const lower = detail.toLowerCase()

    if (isRateLimitError(e)) {
      return { ok: false, status: 429, detail }
    }
    if (
      lower.includes("401") ||
      lower.includes("api key") ||
      lower.includes("authentication")
    ) {
      return { ok: false, status: 502, detail }
    }
    return { ok: false, status: 502, detail }
  }
}
