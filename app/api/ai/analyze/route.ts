import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { groqChatCompletion } from "@/lib/groq-chat"
import { userFacingGroqError } from "@/lib/groq-user-errors"
import { truncateForGroqAnalyze } from "@/lib/groq-truncate"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 })
    }

    const { text, analysisType } = await req.json()
    const raw = typeof text === "string" ? text : ""
    const { text: body, truncated: inputTruncated } = truncateForGroqAnalyze(raw)

    const prompts: Record<string, string> = {
      summary: `Aşağıdaki dokümanı havacılık operasyonları perspektifinden özetle. Önemli bulgular, aksiyon gerektiren maddeler ve risk noktalarını vurgula:\n\n${body}`,
      anomaly: `Aşağıdaki veriyi analiz et. Anomali, sapma veya güvenlik riski oluşturabilecek durumları tespit et ve önem sırasına göre listele:\n\n${body}`,
      report: `Aşağıdaki bilgileri kullanarak resmi bir havacılık uyum raporu oluştur. SHGM standartlarına uygun, profesyonel Türkçe dil kullan:\n\n${body}`,
      regulation_impact: `Aşağıdaki metinde genelde iki tür içerik bulunur: (1) yeni veya güncellenmiş regülasyon / genelge / talimat özeti, (2) şirketin mevcut manuel veya prosedür metinleri (--- ve "DOKÜMAN:" / "PDF:" satırlarıyla ayrılmış bloklar).

Görev: Bu düzenlemenin Bonair Havacılık operasyonları için etkisini değerlendirmek.

Yanıtını Türkçe ve şu başlıklar altında ver:

1) **Regülasyon özeti** — Ne değişiyor, ne zaman/yürürlük beklentisi (metinde varsa).
2) **Operasyonel kapsam** — Hangi faaliyetlerimizi (uçuş operasyonları, eğitim, bakım, SMS, FDM, compliance vb.) doğrudan veya dolaylı etkiler?
3) **Etki kararı** — Operasyonumuza etkili mi? Cevap: **Evet / Hayır / Kısmen** ve kısa gerekçe.
4) **Mevcut şirket metinleriyle karşılaştırma** — Aşağıdaki şirket dokümanları ışığında uyum, çelişki veya boşluk (gap) var mı?
5) **Alınması gereken aksiyonlar** — Numaralı liste: önerilen iş, öncelik (yüksek/orta/düşük), önerilen sorumlu birim tipi (Operasyon, Kalite, Eğitim vb.).
6) **Operasyonel uygunluk** — Uygulanabilirlik ve pratik risk notu (teknik olarak hayata geçirilebilirlik).

Metin:
${body}`,
    }

    const systemDefault = `Sen Bonair Havacılık'ın uzman AI asistanısın. Türk sivil havacılık mevzuatı (SHGM, SHY, SHT), SMS ve FDM konularında uzmansın. Yanıtlarını Türkçe ver.`
    const systemRegulation = `${systemDefault} Regülasyon etki analizinde kesin hukuki danışmanlık vermezsin; çalışma taslağı ve kontrol listesi niteliğinde yanıt verirsin. Metinde olmayan madde numarası uydurmazsın.`

    const userContent = prompts[analysisType] || prompts.summary
    const system =
      analysisType === "regulation_impact" ? systemRegulation : systemDefault

    const result = await groqChatCompletion({
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      maxTokens: analysisType === "regulation_impact" ? 2048 : 1536,
    })

    if (!result.ok) {
      if (result.status === 503) {
        return NextResponse.json({ error: result.detail }, { status: 503 })
      }
      return NextResponse.json(
        { error: userFacingGroqError(result.detail) },
        { status: 502 }
      )
    }

    return NextResponse.json({
      content: result.text,
      ...(inputTruncated ? { inputTruncated: true } : {}),
    })
  } catch {
    return NextResponse.json({ error: "Analiz yapılamadı." }, { status: 500 })
  }
}
