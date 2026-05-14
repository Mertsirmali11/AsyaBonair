/**
 * Basit in-memory rate limiter — harici bağımlılık gerekmez.
 * Tek instance deployment (Vercel serverless) için uygundur.
 * Multi-region veya yüksek trafik için @upstash/ratelimit kullanın.
 */

type Entry = { count: number; resetAt: number }
const store = new Map<string, Entry>()

/** Eski kayıtları temizle (bellek sızıntısı önlemi) */
function evict() {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}

let lastEvict = 0

/**
 * @param key      Benzersiz anahtar (örn. "ai:" + email)
 * @param limit    Pencere başına maksimum istek
 * @param windowMs Pencere süresi (ms)
 * @returns `{ allowed: boolean; remaining: number; resetAt: number }`
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()

  // Her 5 dakikada bir temizlik
  if (now - lastEvict > 5 * 60 * 1000) {
    evict()
    lastEvict = now
  }

  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  entry.count++
  const allowed = entry.count <= limit
  return {
    allowed,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  }
}
