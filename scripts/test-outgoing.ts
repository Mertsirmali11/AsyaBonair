import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { config } from "dotenv"
import { resolve } from "path"

// .env dosyasını yükle
config({ path: resolve(process.cwd(), ".env") })

// Test için PrismaClient oluştur
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

async function testOutgoingCorrespondences() {
  try {
    console.log("🔌 Veritabanı bağlantısı test ediliyor...")
    await prisma.$connect()
    console.log("✅ Veritabanı bağlantısı başarılı!\n")

    // OutgoingCorrespondence tablosunu kontrol et
    console.log("📋 OutgoingCorrespondence tablosu test ediliyor...")
    
    // Tablo var mı kontrol et
    const count = await prisma.outgoingCorrespondence.count()
    console.log(`✅ OutgoingCorrespondence tablosu mevcut! (${count} kayıt)\n`)

    // Test verisi oluştur
    console.log("🧪 Test verisi oluşturuluyor...")
    
    // Önce bir çalışan bulalım
    const testCalisan = await prisma.calisan.findFirst()

    if (!testCalisan) {
      console.log("⚠️  Test için çalışan bulunamadı. Seed çalıştırmanız gerekebilir.")
      await prisma.$disconnect()
      return
    }

    console.log(`✅ Test çalışanı bulundu: ${testCalisan.isim} ${testCalisan.soyisim} (ID: ${testCalisan.id})\n`)

    // Test outgoing correspondence oluştur
    const testCorrespondence = await prisma.outgoingCorrespondence.create({
      data: {
        paperNo: "BON-OC-TEST-001",
        to: "Test Recipient",
        subject: "Test Outgoing Correspondence",
        date: new Date(),
        content: "This is a test outgoing correspondence created by the test script.",
        createdBy: testCalisan.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            isim: true,
            soyisim: true,
            email: true,
          },
        },
      },
    })

    console.log("✅ Test outgoing correspondence oluşturuldu:")
    console.log(`   Paper No: ${testCorrespondence.paperNo}`)
    console.log(`   To: ${testCorrespondence.to}`)
    console.log(`   Subject: ${testCorrespondence.subject}`)
    console.log(`   Created By: ${testCorrespondence.creator?.isim} ${testCorrespondence.creator?.soyisim}\n`)

    // Oluşturulan kaydı oku
    console.log("📖 Oluşturulan kayıt okunuyor...")
    const readCorrespondence = await prisma.outgoingCorrespondence.findUnique({
      where: {
        id: testCorrespondence.id,
      },
      include: {
        creator: true,
      },
    })

    if (readCorrespondence) {
      console.log("✅ Kayıt başarıyla okundu!")
      console.log(`   ID: ${readCorrespondence.id}`)
      console.log(`   Paper No: ${readCorrespondence.paperNo}`)
      console.log(`   To: ${readCorrespondence.to}`)
      console.log(`   Subject: ${readCorrespondence.subject}\n`)
    }

    // Test kaydını sil
    console.log("🗑️  Test kaydı siliniyor...")
    await prisma.outgoingCorrespondence.delete({
      where: {
        id: testCorrespondence.id,
      },
    })
    console.log("✅ Test kaydı silindi!\n")

    // Tüm outgoing correspondences sayısını göster
    const finalCount = await prisma.outgoingCorrespondence.count()
    console.log(`📊 Toplam outgoing correspondence sayısı: ${finalCount}`)

    await prisma.$disconnect()
    console.log("\n✅ Tüm testler başarıyla tamamlandı!")
    
  } catch (error: any) {
    console.error("❌ Test hatası:")
    console.error(error)
    
    if (error.code === 'P2021' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
      console.log("\n⚠️  OutgoingCorrespondence tablosu henüz oluşturulmamış!")
      console.log("💡 Şu komutu çalıştırın: pnpm prisma db push")
    }
    
    await prisma.$disconnect()
    process.exit(1)
  }
}

testOutgoingCorrespondences()
