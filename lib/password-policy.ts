/**
 * Bonair Havacılık — Parola Politikası
 *
 * Tüm şifre oluşturma/değiştirme noktaları bu modülü kullanmalıdır.
 * Kuralları değiştirmek için yalnızca bu dosyayı düzenlemek yeterlidir.
 */

export const PASSWORD_RULES = {
  minLength: 10,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  specialChars: "@$!%*?&.#_-",
} as const

export type PasswordValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] }

/**
 * Parolayı politikaya göre doğrular.
 * Hem sunucu hem istemci tarafında kullanılabilir (server-only değil).
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = []

  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`En az ${PASSWORD_RULES.minLength} karakter olmalı`)
  }
  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("En az bir büyük harf içermeli (A-Z)")
  }
  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("En az bir küçük harf içermeli (a-z)")
  }
  if (PASSWORD_RULES.requireNumber && !/[0-9]/.test(password)) {
    errors.push("En az bir rakam içermeli (0-9)")
  }
  if (
    PASSWORD_RULES.requireSpecial &&
    !new RegExp(`[${PASSWORD_RULES.specialChars.replace(/[-]/g, "\\-")}]`).test(password)
  ) {
    errors.push(`En az bir özel karakter içermeli (${PASSWORD_RULES.specialChars})`)
  }

  if (errors.length > 0) return { valid: false, errors }
  return { valid: true }
}

/** Hata mesajlarını tek string olarak döndürür (API response için) */
export function passwordPolicyMessage(): string {
  return [
    `En az ${PASSWORD_RULES.minLength} karakter`,
    "Büyük harf (A-Z)",
    "Küçük harf (a-z)",
    "Rakam (0-9)",
    `Özel karakter (${PASSWORD_RULES.specialChars})`,
  ].join(", ")
}
