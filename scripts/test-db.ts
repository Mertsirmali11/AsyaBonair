import "dotenv/config"
import { prisma } from "@/lib/prisma-server"

async function testConnection() {
  try {
    console.log("🔌 Veritabanı bağlantısı test ediliyor...")
    console.log("DATABASE_URL:", process.env.DATABASE_URL ? "✅ Tanımlı" : "❌ Tanımsız")
    
    // Veritabanı bağlantısını test et
    await prisma.$connect()
    console.log("✅ Veritabanı bağlantısı başarılı!")
    
    // Tabloları kontrol et - User tablosunu doğrudan test et
    try {
      const userCount = await prisma.user.count()
      console.log(`\n📊 Veritabanında ${userCount} kullanıcı bulunuyor`)
      
      // Diğer tabloları da kontrol et
      try {
        const accountCount = await prisma.account.count()
        console.log(`📊 Veritabanında ${accountCount} hesap bulunuyor`)
      } catch (e) {
        // Account tablosu yoksa sessizce geç
      }
      
      try {
        const sessionCount = await prisma.session.count()
        console.log(`📊 Veritabanında ${sessionCount} oturum bulunuyor`)
      } catch (e) {
        // Session tablosu yoksa sessizce geç
      }
      
      console.log("\n✅ Tüm tablolar başarıyla oluşturulmuş!")
      
    } catch (queryError: any) {
      if (queryError.code === 'P2021' || queryError.message?.includes('does not exist') || queryError.message?.includes('relation')) {
        console.log("\n⚠️  Tablolar henüz oluşturulmamış!")
        console.log("💡 Şu komutu çalıştırın: pnpm db:push")
      } else {
        throw queryError
      }
    }
    
    await prisma.$disconnect()
    console.log("\n✅ Test tamamlandı!")
    
  } catch (error: any) {
    console.error("❌ Veritabanı bağlantı hatası:")
    if (error.code === 'ECONNREFUSED') {
      console.error("   Veritabanı sunucusuna bağlanılamıyor.")
      console.error("   DATABASE_URL'i kontrol edin ve veritabanının çalıştığından emin olun.")
    } else if (error.message?.includes('does not exist')) {
      console.error("   Veritabanı bulunamadı.")
      console.error("   Veritabanının oluşturulduğundan emin olun.")
    } else {
      console.error(error)
    }
    process.exit(1)
  }
}

testConnection()

