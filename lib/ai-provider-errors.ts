/** LLM (Gemini vb.) hata metinlerini kullanıcıya Türkçe özetler. */
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
      "Google ücretsiz katmanda dakikalık istek (RPM) veya token (TPM) sınırına takıldı. " +
      "1–2 dakika bekleyip tekrar deneyin. Gerekirse .env.local içinde GEMINI_MODEL ile başka bir model deneyin " +
      "veya aistudio.google.com üzerinden kota / faturalandırmayı kontrol edin."
    )
  }
  if (
    (lower.includes("404") || lower.includes("not found")) &&
    (lower.includes("model") || lower.includes("models/"))
  ) {
    return (
      "Gemini model adı bu API anahtarı için geçersiz veya artık sunulmuyor. " +
      ".env.local içinde GEMINI_MODEL=gemini-2.0-flash deneyin; olmazsa AI Studio’da ListModels ile uygun adı kontrol edip aynı değişkene yazın ve sunucuyu yeniden başlatın."
    )
  }
  if (
    lower.includes("request too large") ||
    lower.includes("tokens per minute") ||
    lower.includes("tpm") ||
    lower.includes("reduce your message size") ||
    lower.includes("please reduce") ||
    lower.includes("token count") ||
    lower.includes("too long")
  ) {
    return (
      "İstek veya bağlam çok büyük. Metni kısaltın veya manuel seçimini değiştirip tekrar deneyin."
    )
  }
  if (
    lower.includes("invalid api key") ||
    lower.includes("api key not valid") ||
    lower.includes("unauthorized") ||
    lower.includes("permission denied") ||
    lower.includes("api_key_invalid")
  ) {
    return (
      "GEMINI_API_KEY geçersiz veya eksik görünüyor. https://aistudio.google.com/apikey " +
      "adresinden anahtar oluşturup .env.local içinde güncelleyin ve sunucuyu yeniden başlatın."
    )
  }
  if (lower.includes("safety") || lower.includes("blocked")) {
    return "İçerik güvenlik filtreleri nedeniyle yanıt üretilemedi. Soruyu yeniden ifade edin."
  }
  return apiMessage
}
