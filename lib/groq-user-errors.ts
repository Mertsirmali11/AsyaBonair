/** Groq API hata metinlerini kullanıcıya Türkçe özetler. */
export function userFacingGroqError(apiMessage: string): string {
  const lower = apiMessage.toLowerCase()
  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("quota")
  ) {
    return (
      "Groq ücretsiz kotası veya istek sınırına takıldınız. Bir süre sonra tekrar deneyin; " +
      "gerekirse console.groq.com üzerinden limitleri kontrol edin."
    )
  }
  if (
    lower.includes("request too large") ||
    lower.includes("tokens per minute") ||
    lower.includes("tpm") ||
    lower.includes("reduce your message size") ||
    lower.includes("please reduce")
  ) {
    return (
      "İstek çok büyük: Groq ücretsiz katmanı dakikada yaklaşık 12.000 token ile sınırlı. " +
      "Çok uzun PDF’ler otomatik kısaltılır; yine de hata alırsanız metni kısaltın veya birkaç parça halinde analiz edin. " +
      "İsterseniz console.groq.com üzerinden ücretli planla limiti artırabilirsiniz."
    )
  }
  if (
    lower.includes("invalid api key") ||
    lower.includes("invalid_api_key") ||
    lower.includes("unauthorized") ||
    lower.includes("authentication")
  ) {
    return (
      "GROQ_API_KEY geçersiz görünüyor. https://console.groq.com/keys adresinden yeni anahtar oluşturup " +
      ".env.local içinde güncelleyin ve sunucuyu yeniden başlatın."
    )
  }
  return apiMessage
}
