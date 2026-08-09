import "server-only"

import { geminiChatCompletion } from "@/lib/groq-chat"

/** Groq bağlam penceresi ve maliyet için PDF metninden alınan üst sınır. */
const MAX_INPUT_CHARS = 12_000

/**
 * Bir SHGM mevzuatı için kısa (birkaç cümle) AI özeti üretir: ne getiriyor,
 * işletmeyle ilgisi ne, varsa yapılacaklar. PDF metni yoksa (kaynak PDF değil
 * veya indirilemedi) sadece başlık/kategoriden tahmini bir ön değerlendirme
 * üretir ve bunu açıkça belirtir. Groq anahtarı yoksa veya çağrı başarısız
 * olursa null döner — çağıran taraf bunu senkronizasyonu bloklamadan yutmalı.
 */
export async function summarizeShgmRegulation(input: {
  title: string
  categoryLabel: string
  pdfText: string | null
}): Promise<string | null> {
  const context = input.pdfText?.trim() ? input.pdfText.trim().slice(0, MAX_INPUT_CHARS) : null

  const prompt = context
    ? `Aşağıda bir SHGM (Sivil Havacılık Genel Müdürlüğü) mevzuat metninin içeriği var. Bir havacılık işletmesinin operasyon/kalite/uygunluk ekibi için KISA bir özet çıkar (en fazla 4-5 cümle veya kısa madde listesi):
- Bu mevzuat ne getiriyor / neyi değiştiriyor?
- İşletmemiz (bakım/işletme organizasyonu) açısından olası etkisi/ilgisi ne?
- Varsa yapılması gereken somut aksiyon(lar).
Türkçe, resmi ama net bir dille yaz. Metinde açıkça yer almayan teknik detayı uydurma; belirsizse "metinde belirtilmemiş" de.

Mevzuat başlığı: ${input.title}
Kategori: ${input.categoryLabel}

--- MEVZUAT METNİ (kısmi) ---
${context}`
    : `Aşağıdaki SHGM mevzuatı için yalnızca başlık ve kategoriden yola çıkarak KISA (2-3 cümle) bir ön değerlendirme yaz. İçerik metni elde edilemedi — bunun tahmini bir değerlendirme olduğunu ve orijinal belgenin incelenmesi gerektiğini açıkça belirt.

Mevzuat başlığı: ${input.title}
Kategori: ${input.categoryLabel}`

  const result = await geminiChatCompletion({
    messages: [
      {
        role: "system",
        content:
          "Sen bir havacılık uygunluk/kalite uzmanısın. Kısa, öz, iş odaklı özetler yazarsın; abartmaz ve uydurmazsın.",
      },
      { role: "user", content: prompt },
    ],
    maxTokens: 500,
    temperature: 0.3,
  })

  if (!result.ok) {
    console.error("[shgm-summarize] failed:", result.detail)
    return null
  }
  return result.text
}
