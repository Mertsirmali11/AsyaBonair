import "server-only"

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"

export type GroqChatRole = "system" | "user" | "assistant"

export type GroqChatMessage = { role: GroqChatRole; content: string }

export async function groqChatCompletion(input: {
  messages: GroqChatMessage[]
  maxTokens: number
  temperature?: number
}): Promise<
  | { ok: true; text: string }
  | { ok: false; status: number; detail: string }
> {
  const key = process.env.GROQ_API_KEY?.trim()
  if (!key) {
    return {
      ok: false,
      status: 503,
      detail:
        "GROQ_API_KEY tanımlı değil. Ücretsiz anahtar: https://console.groq.com/keys — .env.local dosyasına ekleyip sunucuyu yeniden başlatın.",
    }
  }

  const model =
    process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile"

  const res = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: input.messages,
      max_tokens: input.maxTokens,
      temperature: input.temperature ?? 0.6,
    }),
  })

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { message?: string }
  }

  if (!res.ok) {
    const detail =
      data.error?.message ||
      (typeof data === "object" ? JSON.stringify(data).slice(0, 300) : "") ||
      `HTTP ${res.status}`
    return {
      ok: false,
      status: res.status >= 500 ? 502 : res.status === 429 ? 429 : 502,
      detail,
    }
  }

  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) {
    return { ok: false, status: 502, detail: "Yanıt metni boş." }
  }

  return { ok: true, text }
}
