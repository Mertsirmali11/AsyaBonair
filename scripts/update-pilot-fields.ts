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

async function updatePilotFields() {
  try {
    console.log("🔌 Veritabanı bağlantısı kuruluyor...")
    await prisma.$connect()
    console.log("✅ Veritabanı bağlantısı başarılı!\n")

    // Şu an eklediğimiz uçağın register'ını al
    const ucak = await prisma.ucaklar.findFirst({
      orderBy: {
        id: 'desc'
      }
    })

    if (!ucak) {
      console.log("⚠️  Veritabanında uçak bulunamadı!")
      await prisma.$disconnect()
      return
    }

    const aircraftRegister = ucak.register
    console.log(`✈️  Kullanılacak uçak register: ${aircraftRegister}\n`)

    // 1. Departmanı "Pilot" olmayanların ekstra_1 ve ekstra_2 alanlarını boş yap
    console.log("📝 Departmanı 'Pilot' olmayanların ekstra alanları temizleniyor...")
    const nonPilots = await prisma.calisan.updateMany({
      where: {
        OR: [
          { departman: { not: "Pilot" } },
          { departman: null }
        ]
      },
      data: {
        ekstra1: null,
        ekstra2: null,
      },
    })
    console.log(`✅ ${nonPilots.count} çalışanın ekstra alanları temizlendi.\n`)

    // 2. Departmanı "Pilot" olanların ekstra_1 (aircraft) alanına uçak register'ını yaz
    console.log("✈️  Pilotların aircraft (ekstra_1) alanı güncelleniyor...")
    const pilots = await prisma.calisan.updateMany({
      where: {
        departman: "Pilot"
      },
      data: {
        ekstra1: aircraftRegister,
      },
    })
    console.log(`✅ ${pilots.count} pilotun aircraft alanı güncellendi.\n`)

    // 3. "Tolga Gül" ad soyadlı pilotun ekstra_2 (realpilot) alanına "Captain" yaz
    console.log("👨‍✈️  'Tolga Gül' pilotunun realpilot (ekstra_2) alanı güncelleniyor...")
    const tolgaGul = await prisma.calisan.findFirst({
      where: {
        AND: [
          { isim: "Tolga" },
          { soyisim: "Gül" }
        ]
      },
    })

    if (tolgaGul) {
      const updatedTolga = await prisma.calisan.update({
        where: {
          id: tolgaGul.id,
        },
        data: {
          ekstra2: "Captain",
        },
      })
      console.log(`✅ Tolga Gül pilotunun realpilot alanı 'Captain' olarak güncellendi.`)
      console.log(`   ID: ${updatedTolga.id}`)
      console.log(`   İsim: ${updatedTolga.isim} ${updatedTolga.soyisim}`)
      console.log(`   Aircraft (ekstra_1): ${updatedTolga.ekstra1}`)
      console.log(`   RealPilot (ekstra_2): ${updatedTolga.ekstra2}\n`)
    } else {
      console.log("⚠️  'Tolga Gül' adında bir pilot bulunamadı.")
      console.log("   Mevcut pilotlar:")
      const allPilots = await prisma.calisan.findMany({
        where: {
          departman: "Pilot"
        },
        select: {
          id: true,
          isim: true,
          soyisim: true,
          email: true,
        }
      })
      allPilots.forEach(pilot => {
        console.log(`   - ${pilot.isim} ${pilot.soyisim} (${pilot.email})`)
      })
      console.log()
    }

    // Güncellenmiş pilotları göster
    console.log("📋 Güncellenmiş pilotlar:")
    const updatedPilots = await prisma.calisan.findMany({
      where: {
        departman: "Pilot"
      },
      select: {
        id: true,
        isim: true,
        soyisim: true,
        ekstra1: true,
        ekstra2: true,
      },
      orderBy: {
        id: 'asc'
      }
    })

    updatedPilots.forEach(pilot => {
      console.log(`   ${pilot.isim} ${pilot.soyisim}:`)
      console.log(`     Aircraft (ekstra_1): ${pilot.ekstra1 || "(boş)"}`)
      console.log(`     RealPilot (ekstra_2): ${pilot.ekstra2 || "(boş)"}`)
    })

    await prisma.$disconnect()
    console.log("\n✅ Tüm güncellemeler başarıyla tamamlandı!")
    
  } catch (error: any) {
    console.error("❌ Hata oluştu:")
    console.error(error)
    
    await prisma.$disconnect()
    process.exit(1)
  }
}

updatePilotFields()
