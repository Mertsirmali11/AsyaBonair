/**
 * E-posta ve dış bağlantılar için site kök URL’si.
 * Üretimde `NEXT_PUBLIC_APP_URL` (örn. https://app.sirketiniz.com) tanımlayın.
 */
export function getAppPublicUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`
  return ""
}
