import "server-only"

import { GoogleGenerativeAI } from "@google/generative-ai"

export type GeminiChatRole = "system" | "user" | "assistant"

export type GeminiChatMessage = { role: GeminiChatRole; content: string }

function resolveApiKey(): string | null {
  const k =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
  return k && k.length > 0 ? k : null
}

function defaultModel(): string {
  // AI Studio’da geçerli flash modeli; 1.5 adsız isimler bazı projelerde 404 veriyor.
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash"
}

function extractTextFromError(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === "object" && e !== null && "message" in e) {
    const m = (e as { message?: unknown }).message
    if (typeof m === "string") return m
  }
  return String(e)
}

function isRetryableQuotaOrRateError(detail: string): boolean {
  const lower = detail.toLowerCase()
  return (
    lower.includes("quota") ||
    lower.includes("resource exhausted") ||
    lower.includes("resource_exhausted") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("429")
  )
}

const GEMINI_RETRY_ATTEMPTS = 3
const GEMINI_RETRY_DELAY_MS = [0, 2_000, 5_000] as const

/**
 * OpenAI/Groq tarzı mesaj listesi: ilk mesaj `system` olabilir; sohbet `user`/`assistant`
 * ile devam eder ve son mesaj her zaman `user` olmalı (Gemini chat kuralı).
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
        "GEMINI_API_KEY tanımlı değil. Google AI Studio: https://aistudio.google.com/apikey — anahtarı .env.local dosyasına ekleyip sunucuyu yeniden başlatın.",
    }
  }

  const modelName = defaultModel()
  let systemInstruction: string | undefined
  let rest = input.messages
  if (rest[0]?.role === "system") {
    systemInstruction = rest[0].content
    rest = rest.slice(1)
  }

  if (rest.length === 0) {
    return { ok: false, status: 400, detail: "Geçerli mesaj yok." }
  }

  const last = rest[rest.length - 1]
  if (last.role !== "user") {
    return {
      ok: false,
      status: 400,
      detail: "Son mesaj kullanıcı (user) olmalı.",
    }
  }

  const history = rest.slice(0, -1).map((m) => {
    if (m.role === "assistant") {
      return { role: "model" as const, parts: [{ text: m.content }] }
    }
    return { role: "user" as const, parts: [{ text: m.content }] }
  })

  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: {
      maxOutputTokens: input.maxTokens,
      temperature: input.temperature ?? 0.6,
    },
  })

  let lastDetail = ""
  for (let attempt = 0; attempt < GEMINI_RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((r) =>
        setTimeout(r, GEMINI_RETRY_DELAY_MS[attempt] ?? 2_000)
      )
    }
    try {
      const chat = model.startChat({ history })
      const result = await chat.sendMessage(last.content)
      const text = result.response.text()?.trim()
      if (!text) {
        return { ok: false, status: 502, detail: "Yanıt metni boş." }
      }
      return { ok: true, text }
    } catch (e) {
      lastDetail = extractTextFromError(e)
      if (
        isRetryableQuotaOrRateError(lastDetail) &&
        attempt < GEMINI_RETRY_ATTEMPTS - 1
      ) {
        continue
      }
      const lower = lastDetail.toLowerCase()
      const isModel404 =
        (lower.includes("404") || lower.includes("not found")) &&
        (lower.includes("model") || lower.includes("models/"))
      const status =
        lower.includes("quota") ||
        lower.includes("resource exhausted") ||
        lower.includes("rate limit") ||
        lower.includes("429")
          ? 429
          : lower.includes("api key") ||
              lower.includes("permission") ||
              lower.includes("401") ||
              lower.includes("403")
            ? 502
            : isModel404
              ? 502
              : 502
      return { ok: false, status, detail: lastDetail }
    }
  }

  return { ok: false, status: 429, detail: lastDetail || "Bilinmeyen hata." }
}
