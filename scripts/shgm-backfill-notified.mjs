/**
 * Tek seferlik veri backfill'i — SHGM Mevzuat portal yeniden düzenlemesi kapsamında.
 *
 * Amaç: `shgm_regulation_revisions.email_sent_at` alanı NULL olan (yani hiç mail
 * gitmemiş) tüm eski kayıtları "bildirim gerekmiyor" olarak işaretler. Bu, yeni
 * per-item bildirim + retry-unsent mantığının devreye girdiği anda, Temmuz'daki
 * ilk toplu taramadan kalan ~846 eski kayıt için compliance@bonair.com.tr'ye
 * toplu/anlamsız mail gitmesini önler. Kullanıcı onayıyla çalıştırılmıştır
 * (bkz. sohbet geçmişi — "Backfill: eski kayıtları bildirim gerekmiyor işaretle").
 *
 * Şema değişikliği DEĞİLDİR — sadece mevcut `email_sent_at` kolonunu doldurur.
 * Idempotent: ikinci çalıştırmada etkilenen satır sayısı 0 olur.
 *
 * Çalıştırma: node -r dotenv/config scripts/shgm-backfill-notified.mjs dotenv_config_path=.env.local
 */
import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"

const connectionString = process.env.DATABASE_URL.replace("prisma+postgres://", "postgresql://")
const pool = new Pool({ connectionString, max: 1 })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const before = await prisma.shgmRegulationRevision.count({ where: { emailSentAt: null } })
console.log(`emailSentAt IS NULL olan kayıt sayısı (öncesi): ${before}`)

const result = await prisma.shgmRegulationRevision.updateMany({
  where: { emailSentAt: null },
  data: { emailSentAt: new Date() },
})
console.log(`Güncellenen satır sayısı: ${result.count}`)

const after = await prisma.shgmRegulationRevision.count({ where: { emailSentAt: null } })
console.log(`emailSentAt IS NULL olan kayıt sayısı (sonrası): ${after}`)

await prisma.$disconnect()
