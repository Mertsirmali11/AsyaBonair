/** LLM hata metinlerini kullanıcıya Türkçe özetler. */
export function userFacingAiError(apiMessage: string): string {
  const lower = apiMessage.toLowerCase()

  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("quota") ||
    lower.includes("resource exhausted") ||
    lower.includes("resource_exhausted")
  ) {
    return (
      "Groq ücretsiz katmanda dakikalık istek (RPM) veya token (TPM) sınırına takıldı. " +
      "1–2 dakika bekleyip tekrar deneyin. Gerekirse .env.local içinde GROQ_MODEL ile başka bir model deneyin " +
      "veya console.groq.com üzerinden kota / faturalandırmayı kontrol edin."
    )
  }
  if (
    lower.includes("request too large") ||
    lower.includes("tokens per minute") ||
    lower.includes("tpm") ||
    lower.includes("reduce your message size") ||
    lower.includes("please reduce") ||
    lower.includes("token count") ||
    lower.includes("too long") ||
    lower.includes("context_length_exceeded")
  ) {
    return "İstek veya bağlam çok büyük. Metni kısaltın veya manuel seçimini değiştirip tekrar deneyin."
  }
  if (
    lower.includes("invalid api key") ||
    lower.includes("api key not valid") ||
    lower.includes("unauthorized") ||
    lower.includes("permission denied") ||
    lower.includes("api_key_invalid") ||
    lower.includes("authentication")
  ) {
    return (
      "GROQ_API_KEY geçersiz veya eksik görünüyor. https://console.groq.com/keys " +
      "adresinden anahtar oluşturup .env.local içinde güncelleyin ve sunucuyu yeniden başlatın."
    )
  }
  if (lower.includes("safety") || lower.includes("blocked")) {
    return "İçerik güvenlik filtreleri nedeniyle yanıt üretilemedi. Soruyu yeniden ifade edin."
  }
  return apiMessage
}
