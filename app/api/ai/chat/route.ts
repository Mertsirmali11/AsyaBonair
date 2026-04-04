import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: `Sen Bonair Havacılık'ın yapay zeka asistanısın. Türk sivil havacılık mevzuatı (SHGM, SHY, SHT), uçuş operasyonları, SMS (Safety Management System) ve FDM (Flight Data Monitoring) konularında uzmansın. Kullanıcılara her zaman Türkçe yanıt verirsin. Bilmediğin veya doğrulayamadığın mevzuat maddelerini uydurmak yerine kullanıcıya resmi kaynağı kontrol etmesini söylersin.`,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: "AI servisi hatası." }, { status: 500 });
    }

    return NextResponse.json({ content: data.content[0].text });
  } catch {
    return NextResponse.json({ error: "Bağlantı hatası." }, { status: 500 });
  }
}
