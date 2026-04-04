import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text, analysisType } = await req.json();

    const prompts: Record<string, string> = {
      summary: `Aşağıdaki dokümanı havacılık operasyonları perspektifinden özetle. Önemli bulgular, aksiyon gerektiren maddeler ve risk noktalarını vurgula:\n\n${text}`,
      anomaly: `Aşağıdaki veriyi analiz et. Anomali, sapma veya güvenlik riski oluşturabilecek durumları tespit et ve önem sırasına göre listele:\n\n${text}`,
      report: `Aşağıdaki bilgileri kullanarak resmi bir havacılık uyum raporu oluştur. SHGM standartlarına uygun, profesyonel Türkçe dil kullan:\n\n${text}`,
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: `Sen Bonair Havacılık'ın uzman AI asistanısın. Türk sivil havacılık mevzuatı (SHGM, SHY, SHT), SMS ve FDM konularında uzmansın. Yanıtlarını Türkçe ver.`,
        messages: [{ role: "user", content: prompts[analysisType] || prompts.summary }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: "AI servisi hatası." }, { status: 500 });
    }

    return NextResponse.json({ content: data.content[0].text });
  } catch (error) {
    return NextResponse.json({ error: "Analiz yapılamadı." }, { status: 500 });
  }
}
