import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { config } from "dotenv"
import { resolve } from "path"

// .env dosyasını yükle
config({ path: resolve(process.cwd(), ".env") })

// PrismaClient oluştur
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set. Make sure .env file exists.")
}

const cleanConnectionString = connectionString.startsWith("prisma+postgres://")
  ? connectionString.replace("prisma+postgres://", "postgresql://")
  : connectionString

const pool = new Pool({
  connectionString: cleanConnectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
})

const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({
  adapter: adapter,
  log: ["error", "warn"],
})

// Rastgele register ve msn oluştur
function generateRandomRegister(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const numbers = "0123456789"
  const letter1 = letters[Math.floor(Math.random() * letters.length)]
  const letter2 = letters[Math.floor(Math.random() * letters.length)]
  const number1 = numbers[Math.floor(Math.random() * numbers.length)]
  const number2 = numbers[Math.floor(Math.random() * numbers.length)]
  const number3 = numbers[Math.floor(Math.random() * numbers.length)]
  return `TC-${letter1}${letter2}${number1}${number2}${number3}`
}

function generateRandomMSN(): string {
  // MSN genellikle 5-6 haneli sayılardan oluşur
  const min = 10000
  const max = 999999
  return String(Math.floor(Math.random() * (max - min + 1)) + min)
}

async function createUcak() {
  try {
    console.log("🔌 Veritabanı bağlantısı kuruluyor...")
    await prisma.$connect()
    console.log("✅ Veritabanı bağlantısı başarılı!\n")

    // Rastgele değerler oluştur
    const register = generateRandomRegister()
    const msn = generateRandomMSN()

    console.log("✈️  Yeni uçak oluşturuluyor...")
    console.log(`   Register: ${register}`)
    console.log(`   MSN: ${msn}\n`)

    // Uçak oluştur
    const yeniUcak = await prisma.ucaklar.create({
      data: {
        register: register,
        msn: msn,
      },
    })

    console.log("✅ Uçak başarıyla oluşturuldu!")
    console.log(`   ID: ${yeniUcak.id}`)
    console.log(`   Register: ${yeniUcak.register}`)
    console.log(`   MSN: ${yeniUcak.msn}\n`)

    // Oluşturulan kaydı doğrula
    const kontrolUcak = await prisma.ucaklar.findUnique({
      where: {
        id: yeniUcak.id,
      },
    })

    if (kontrolUcak) {
      console.log("✅ Kayıt doğrulandı!")
      console.log(`   ID: ${kontrolUcak.id}`)
      console.log(`   Register: ${kontrolUcak.register}`)
      console.log(`   MSN: ${kontrolUcak.msn}\n`)
    }

    // Toplam uçak sayısını göster
    const toplamUcak = await prisma.ucaklar.count()
    console.log(`📊 Toplam uçak sayısı: ${toplamUcak}`)

    await prisma.$disconnect()
    console.log("\n✅ İşlem başarıyla tamamlandı!")
    
  } catch (error: any) {
    console.error("❌ Hata oluştu:")
    console.error(error)
    
    if (error.code === 'P2021' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
      console.log("\n⚠️  Ucaklar tablosu henüz oluşturulmamış!")
      console.log("💡 Şu komutu çalıştırın: pnpm prisma db push")
    }
    
    await prisma.$disconnect()
    process.exit(1)
  }
}

createUcak()
