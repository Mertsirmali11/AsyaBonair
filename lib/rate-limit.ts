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

function getOrCreate(key: string, windowMs: number): Entry {
  const now = Date.now()

  if (now - lastEvict > 5 * 60 * 1000) {
    evict()
    lastEvict = now
  }

  const entry = store.get(key)
  if (!entry || entry.resetAt < now) {
    const fresh: Entry = { count: 0, resetAt: now + windowMs }
    store.set(key, fresh)
    return fresh
  }
  return entry
}

/**
 * Sayacı artırır ve limitin aşılıp aşılmadığını döndürür.
 * @param key      Benzersiz anahtar (örn. "ai:" + email)
 * @param limit    Pencere başına maksimum istek
 * @param windowMs Pencere süresi (ms)
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const entry = getOrCreate(key, windowMs)
  entry.count++
  const allowed = entry.count <= limit
  return {
    allowed,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  }
}

/**
 * Sayacı artırmadan sadece kilitli olup olmadığını kontrol eder.
 * Login akışında: önce kontrol et, başarısız olursa artır.
 */
export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number
): { limited: boolean; resetAt: number } {
  const entry = getOrCreate(key, windowMs)
  return {
    limited: entry.count >= limit,
    resetAt: entry.resetAt,
  }
}

/** Belirli bir key'in sayacını sıfırlar (başarılı işlemler sonrası kullan). */
export function resetRateLimit(key: string): void {
  store.delete(key)
}
