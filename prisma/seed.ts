import { config } from "dotenv"
import { resolve } from "path"
import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

// .env dosyasını yükle
config({ path: resolve(process.cwd(), ".env") })

// Seed için PrismaClient oluştur
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set. Make sure .env file exists.")
}

console.log("🔌 Connecting to database...")

// Connection string'i temizle
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

async function main() {
  try {
    await prisma.$connect()
    console.log("✅ Database connection successful!")
    
    // ============ ADMIN USER ============
    console.log("\n👤 Creating admin user...")
    const hashedPasswordAdmin = await bcrypt.hash("admin123", 10)

    const adminUser = await prisma.user.upsert({
      where: { email: "admin@example.com" },
      update: {
        password: hashedPasswordAdmin,
        name: "Admin User",
      },
      create: {
        email: "admin@example.com",
        name: "Admin User",
        password: hashedPasswordAdmin,
      },
    })
    console.log(`  ✅ Admin: ${adminUser.email} (password: admin123)`)

    // ============ EMPLOYEES ============
    console.log("\n👥 Creating employees...")
    const hashedPasswordCalisan = await bcrypt.hash("bonair2025", 10)

    // Asya Temur - Administrative Affairs (has Configurations access)
    const asya = await prisma.calisan.upsert({
      where: { email: "atemur@gmail.com" },
      update: {
        isim: "Asya",
        soyisim: "Temur",
        departman: "Administrative Affairs",
        password: hashedPasswordCalisan,
      },
      create: {
        isim: "Asya",
        soyisim: "Temur",
        email: "atemur@gmail.com",
        departman: "Administrative Affairs",
        password: hashedPasswordCalisan,
      },
    })
    console.log(`  ✅ Employee: ${asya.isim} ${asya.soyisim} (${asya.email}) - Administrative Affairs`)

    // Julide Tosun
    const julide = await prisma.calisan.upsert({
      where: { email: "jtosun@gmail.com" },
      update: {
        isim: "Julide",
        soyisim: "Tosun",
        password: hashedPasswordCalisan,
      },
      create: {
        isim: "Julide",
        soyisim: "Tosun",
        email: "jtosun@gmail.com",
        password: hashedPasswordCalisan,
      },
    })
    console.log(`  ✅ Employee: ${julide.isim} ${julide.soyisim} (${julide.email})`)

    // Mert Yılmaz - Maintenance
    const mert = await prisma.calisan.upsert({
      where: { email: "myilmaz@example.com" },
      update: {
        isim: "Mert",
        soyisim: "Yılmaz",
        departman: "Maintenance",
        telNo: "05321234567",
        dogumTarihi: new Date("1990-05-15"),
        medeniDurum: "Married",
        cocuk: 2,
        kanGrubu: "A+",
        password: hashedPasswordCalisan,
      },
      create: {
        isim: "Mert",
        soyisim: "Yılmaz",
        email: "myilmaz@example.com",
        departman: "Maintenance",
        telNo: "05321234567",
        dogumTarihi: new Date("1990-05-15"),
        medeniDurum: "Married",
        cocuk: 2,
        kanGrubu: "A+",
        iseGirisTarihi: new Date("2020-03-01"),
        password: hashedPasswordCalisan,
      },
    })
    console.log(`  ✅ Employee: ${mert.isim} ${mert.soyisim} (${mert.email})`)

    // Elif Kaya - Human Resources
    const elif = await prisma.calisan.upsert({
      where: { email: "ekaya@example.com" },
      update: {
        isim: "Elif",
        soyisim: "Kaya",
        departman: "Human Resources",
        telNo: "05339876543",
        dogumTarihi: new Date("1988-11-22"),
        medeniDurum: "Single",
        cocuk: 0,
        kanGrubu: "B+",
        password: hashedPasswordCalisan,
      },
      create: {
        isim: "Elif",
        soyisim: "Kaya",
        email: "ekaya@example.com",
        departman: "Human Resources",
        telNo: "05339876543",
        dogumTarihi: new Date("1988-11-22"),
        medeniDurum: "Single",
        cocuk: 0,
        kanGrubu: "B+",
        iseGirisTarihi: new Date("2019-06-15"),
        password: hashedPasswordCalisan,
      },
    })
    console.log(`  ✅ Employee: ${elif.isim} ${elif.soyisim} (${elif.email})`)

    // Ahmet Demir - Engineering
    const ahmet = await prisma.calisan.upsert({
      where: { email: "ademir@example.com" },
      update: {
        isim: "Ahmet",
        soyisim: "Demir",
        departman: "Engineering",
        telNo: "05351112233",
        dogumTarihi: new Date("1985-03-10"),
        medeniDurum: "Married",
        cocuk: 1,
        kanGrubu: "O+",
        password: hashedPasswordCalisan,
      },
      create: {
        isim: "Ahmet",
        soyisim: "Demir",
        email: "ademir@example.com",
        departman: "Engineering",
        telNo: "05351112233",
        dogumTarihi: new Date("1985-03-10"),
        medeniDurum: "Married",
        cocuk: 1,
        kanGrubu: "O+",
        iseGirisTarihi: new Date("2018-01-10"),
        password: hashedPasswordCalisan,
      },
    })
    console.log(`  ✅ Employee: ${ahmet.isim} ${ahmet.soyisim} (${ahmet.email})`)

    // Zeynep Öztürk - Quality
    const zeynep = await prisma.calisan.upsert({
      where: { email: "zozturk@example.com" },
      update: {
        isim: "Zeynep",
        soyisim: "Öztürk",
        departman: "Quality",
        telNo: "05364445566",
        dogumTarihi: new Date("1992-07-08"),
        medeniDurum: "Single",
        cocuk: 0,
        kanGrubu: "AB+",
        password: hashedPasswordCalisan,
      },
      create: {
        isim: "Zeynep",
        soyisim: "Öztürk",
        email: "zozturk@example.com",
        departman: "Quality",
        telNo: "05364445566",
        dogumTarihi: new Date("1992-07-08"),
        medeniDurum: "Single",
        cocuk: 0,
        kanGrubu: "AB+",
        iseGirisTarihi: new Date("2021-09-01"),
        password: hashedPasswordCalisan,
      },
    })
    console.log(`  ✅ Employee: ${zeynep.isim} ${zeynep.soyisim} (${zeynep.email})`)

    // Can Arslan - IT
    const can = await prisma.calisan.upsert({
      where: { email: "carslan@example.com" },
      update: {
        isim: "Can",
        soyisim: "Arslan",
        departman: "IT",
        telNo: "05377778899",
        dogumTarihi: new Date("1995-12-25"),
        medeniDurum: "Single",
        cocuk: 0,
        kanGrubu: "A-",
        password: hashedPasswordCalisan,
      },
      create: {
        isim: "Can",
        soyisim: "Arslan",
        email: "carslan@example.com",
        departman: "IT",
        telNo: "05377778899",
        dogumTarihi: new Date("1995-12-25"),
        medeniDurum: "Single",
        cocuk: 0,
        kanGrubu: "A-",
        iseGirisTarihi: new Date("2022-02-14"),
        password: hashedPasswordCalisan,
      },
    })
    console.log(`  ✅ Employee: ${can.isim} ${can.soyisim} (${can.email})`)

    console.log("\n✅ Seed completed!")
    console.log("\n📋 User Information:")
    console.log("  Admin: admin@example.com / admin123")
    console.log("  Employee: atemur@gmail.com / bonair2025")
    console.log("  Employee: jtosun@gmail.com / bonair2025")
    console.log("  Employee: myilmaz@example.com / bonair2025")
    console.log("  Employee: ekaya@example.com / bonair2025")
    console.log("  Employee: ademir@example.com / bonair2025")
    console.log("  Employee: zozturk@example.com / bonair2025")
    console.log("  Employee: carslan@example.com / bonair2025")
    
  } catch (error: any) {
    console.error("❌ Seed hatası:")
    if (error.code === 'ECONNREFUSED') {
      console.error("   Veritabanı sunucusuna bağlanılamıyor.")
      console.error("   DATABASE_URL'i kontrol edin ve veritabanının çalıştığından emin olun.")
    } else {
      console.error(error)
    }
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

