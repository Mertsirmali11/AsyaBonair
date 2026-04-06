/** Anthropic API İngilizce hata metinlerini kullanıcıya Türkçe özetler. */
export function userFacingAnthropicError(apiMessage: string): string {
  const lower = apiMessage.toLowerCase()
  if (
    lower.includes("credit balance") ||
    lower.includes("too low to access") ||
    lower.includes("purchase credits")
  ) {
    return (
      "Anthropic hesabınızda kullanılabilir kredi / bakiye yetersiz görünüyor. " +
      "https://console.anthropic.com adresinde Plans & Billing bölümünden kredi yükleyin veya planı yükseltin; işlem sonrası tekrar deneyin."
    )
  }
  if (
    lower.includes("invalid api key") ||
    lower.includes("authentication") ||
    lower.includes("permission")
  ) {
    return (
      "API anahtarı geçersiz veya yetkisiz olabilir. console.anthropic.com üzerinden yeni bir anahtar oluşturup .env.local içindeki ANTHROPIC_API_KEY değerini güncelleyin ve sunucuyu yeniden başlatın."
    )
  }
  return apiMessage
}
