import "dotenv/config"

async function testOutgoingCorrespondencesAPI() {
  try {
    console.log("🧪 Outgoing Correspondences API test ediliyor...\n")

    // GET endpoint test
    console.log("1️⃣  GET /api/outgoing-correspondences test ediliyor...")
    try {
      const getResponse = await fetch("http://localhost:3000/api/outgoing-correspondences", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (getResponse.status === 401) {
        console.log("   ⚠️  Unauthorized - Bu normal, authentication gerekiyor")
      } else if (getResponse.ok) {
        const data = await getResponse.json()
        console.log(`   ✅ GET başarılı! ${Array.isArray(data) ? data.length : 0} kayıt döndü`)
      } else {
        console.log(`   ⚠️  GET response: ${getResponse.status} ${getResponse.statusText}`)
      }
    } catch (error: any) {
      if (error.code === "ECONNREFUSED") {
        console.log("   ⚠️  Server çalışmıyor. 'pnpm run dev' komutu ile server'ı başlatın.")
      } else {
        console.log(`   ❌ GET hatası: ${error.message}`)
      }
    }

    console.log("\n✅ API test tamamlandı!")
    console.log("\n💡 Not: POST endpoint'i için authentication gerekiyor.")
    console.log("   Gerçek test için browser'da /correspondences/outgoing sayfasını kullanın.")
    
  } catch (error: any) {
    console.error("❌ Test hatası:", error.message)
  }
}

testOutgoingCorrespondencesAPI()

