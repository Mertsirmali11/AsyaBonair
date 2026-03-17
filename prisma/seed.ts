import { config } from "dotenv"
import { resolve } from "path"
import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import { existsSync } from "fs"

// .env.local (preferred) then .env
const envLocalPath = resolve(process.cwd(), ".env.local")
const envPath = resolve(process.cwd(), ".env")
config({ path: existsSync(envLocalPath) ? envLocalPath : envPath })

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

    // Asya Temur - Quality Department
    const asya = await prisma.calisan.upsert({
      where: { email: "atemur@gmail.com" },
      update: {
        isim: "Asya",
        soyisim: "Temur",
        departman: "Quality",
        password: hashedPasswordCalisan,
      },
      create: {
        isim: "Asya",
        soyisim: "Temur",
        email: "atemur@gmail.com",
        departman: "Quality",
        password: hashedPasswordCalisan,
      },
    })
    console.log(`  ✅ Employee: ${asya.isim} ${asya.soyisim} (${asya.email}) - Quality`)

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

    // Pilot employees (reset + create 5 Turkish pilots)
    console.log("\n🧹 Resetting Pilot employees...")
    await prisma.calisan.deleteMany({
      where: { departman: "Pilot" },
    })
    console.log("  ✅ Deleted existing Pilot employees")

    console.log("\n✈️ Creating 5 pilot employees...")
    const pilotSeed = [
      {
        isim: "Kerem",
        soyisim: "Yıldız",
        email: "pilot.kerem@bonair.local",
        telNo: "05310000001",
        dogumTarihi: new Date("1987-02-14"),
        medeniDurum: "Married",
        cocuk: 1,
        kanGrubu: "A+",
        iseGirisTarihi: new Date("2011-06-01"),
      },
      {
        isim: "Seda",
        soyisim: "Aksoy",
        email: "pilot.seda@bonair.local",
        telNo: "05310000002",
        dogumTarihi: new Date("1991-09-03"),
        medeniDurum: "Single",
        cocuk: 0,
        kanGrubu: "B+",
        iseGirisTarihi: new Date("2016-03-15"),
      },
      {
        isim: "Emre",
        soyisim: "Şahin",
        email: "pilot.emre@bonair.local",
        telNo: "05310000003",
        dogumTarihi: new Date("1989-12-22"),
        medeniDurum: "Married",
        cocuk: 2,
        kanGrubu: "O+",
        iseGirisTarihi: new Date("2013-10-10"),
      },
      {
        isim: "Buse",
        soyisim: "Karaca",
        email: "pilot.buse@bonair.local",
        telNo: "05310000004",
        dogumTarihi: new Date("1993-04-08"),
        medeniDurum: "Single",
        cocuk: 0,
        kanGrubu: "AB+",
        iseGirisTarihi: new Date("2018-07-20"),
      },
      {
        isim: "Onur",
        soyisim: "Çelik",
        email: "pilot.onur@bonair.local",
        telNo: "05310000005",
        dogumTarihi: new Date("1986-07-19"),
        medeniDurum: "Married",
        cocuk: 1,
        kanGrubu: "A-",
        iseGirisTarihi: new Date("2010-01-15"),
      },
    ] as const

    const createdPilots = []
    for (const p of pilotSeed) {
      const created = await prisma.calisan.create({
        data: {
          ...p,
          departman: "Pilot",
          password: hashedPasswordCalisan,
        },
        select: { id: true, isim: true, soyisim: true, email: true },
      })
      createdPilots.push(created)
      console.log(`  ✅ Pilot: ${created.isim} ${created.soyisim} (${created.email})`)
    }

    // ============ HAZARD REPORTS ============
    console.log("\n⚠️ Creating hazard reports...")

    // Reset existing seed hazard reports to avoid unique conflicts
    await prisma.hazardReport.deleteMany({
      where: {
        reportNo: {
          in: [
            "BON-HR-001",
            "BON-HR-002",
            "BON-HR-003",
            "BON-HR-004",
            "BON-HR-005",
            "BON-HR-006",
            "BON-HR-007",
            "BON-HR-008",
          ],
        },
      },
    })
    
    // Report 1 - Safety Observation from Maintenance
    const report1 = await prisma.hazardReport.create({
      data: {
        reportNo: "BON-HR-001",
        eventDate: new Date("2025-12-20"),
        sourceType: "Safety Observation",
        isAnonymous: false,
        title: "Slippery floor in hangar area",
        details: "The floor in hangar area 3 has become very slippery due to oil spillage. This poses a significant safety risk to maintenance personnel working in the area. Immediate cleaning and proper signage required.",
        reportedBy: mert.id,
      },
    })
    console.log(`  ✅ Report 1: ${report1.reportNo} - ${report1.title} (by ${mert.isim} ${mert.soyisim})`)

    // Report 2 - Incident Report from Quality
    const report2 = await prisma.hazardReport.create({
      data: {
        reportNo: "BON-HR-002",
        eventDate: new Date("2025-12-22"),
        sourceType: "Incident Report",
        isAnonymous: false,
        title: "Equipment malfunction during inspection",
        details: "During routine quality inspection, the testing equipment malfunctioned and could have caused injury. The equipment needs immediate maintenance and safety review. No injuries occurred but the potential for harm was significant.",
        reportedBy: asya.id,
      },
    })
    console.log(`  ✅ Report 2: ${report2.reportNo} - ${report2.title} (by ${asya.isim} ${asya.soyisim})`)

    // Report 3 - Near Miss from Engineering
    const report3 = await prisma.hazardReport.create({
      data: {
        reportNo: "BON-HR-003",
        eventDate: new Date("2025-12-23"),
        sourceType: "Near Miss",
        isAnonymous: false,
        title: "Falling tool from elevated platform",
        details: "A wrench fell from an elevated platform during maintenance work. Fortunately, no one was injured, but this highlights the need for better tool management and safety protocols at height. Tool tethering should be mandatory.",
        reportedBy: ahmet.id,
      },
    })
    console.log(`  ✅ Report 3: ${report3.reportNo} - ${report3.title} (by ${ahmet.isim} ${ahmet.soyisim})`)

    // Report 4 - Anonymous Hazard Identification
    const report4 = await prisma.hazardReport.create({
      data: {
        reportNo: "BON-HR-004",
        eventDate: new Date("2025-12-24"),
        sourceType: "Hazard Identification",
        isAnonymous: true,
        title: "Exposed electrical wiring in break room",
        details: "There is exposed electrical wiring near the coffee machine in the break room. This is a serious electrical hazard that needs immediate attention. The area should be cordoned off until repairs are completed.",
        reportedBy: null,
      },
    })
    console.log(`  ✅ Report 4: ${report4.reportNo} - ${report4.title} (Anonymous)`)

    // Report 5 - Safety Observation from IT
    const report5 = await prisma.hazardReport.create({
      data: {
        reportNo: "BON-HR-005",
        eventDate: new Date("2025-12-25"),
        sourceType: "Safety Observation",
        isAnonymous: false,
        title: "Blocked emergency exit",
        details: "The emergency exit on the second floor is partially blocked by storage boxes. This violates fire safety regulations and could prevent quick evacuation in case of emergency. Please relocate the storage immediately.",
        reportedBy: can.id,
      },
    })
    console.log(`  ✅ Report 5: ${report5.reportNo} - ${report5.title} (by ${can.isim} ${can.soyisim})`)

    // Report 6 - Incident Report from Human Resources
    const report6 = await prisma.hazardReport.create({
      data: {
        reportNo: "BON-HR-006",
        eventDate: new Date("2025-12-26"),
        sourceType: "Incident Report",
        isAnonymous: false,
        title: "Chemical spill in storage area",
        details: "A small chemical container leaked in the storage area. The spill was contained quickly, but proper handling procedures need to be reviewed. Material Safety Data Sheets should be more accessible.",
        reportedBy: elif.id,
      },
    })
    console.log(`  ✅ Report 6: ${report6.reportNo} - ${report6.title} (by ${elif.isim} ${elif.soyisim})`)

    // Report 7 - Near Miss from Pilot
    const report7 = await prisma.hazardReport.create({
      data: {
        reportNo: "BON-HR-007",
        eventDate: new Date("2025-12-27"),
        sourceType: "Near Miss",
        isAnonymous: false,
        title: "Ground vehicle too close to aircraft",
        details: "During aircraft parking, a ground vehicle came dangerously close to the aircraft wing. Better communication and coordination between ground crew and vehicle operators is needed. No damage occurred but the risk was high.",
        reportedBy: createdPilots[0].id,
      },
    })
    console.log(`  ✅ Report 7: ${report7.reportNo} - ${report7.title} (by ${createdPilots[0].isim} ${createdPilots[0].soyisim})`)

    // Report 8 - Other type from Quality
    const report8 = await prisma.hazardReport.create({
      data: {
        reportNo: "BON-HR-008",
        eventDate: new Date("2025-12-28"),
        sourceType: "Other",
        isAnonymous: false,
        title: "Inadequate lighting in workshop",
        details: "The lighting in the main workshop is insufficient for safe operation of machinery. Several areas have shadows that could lead to accidents. Improved lighting installation is recommended.",
        reportedBy: zeynep.id,
      },
    })
    console.log(`  ✅ Report 8: ${report8.reportNo} - ${report8.title} (by ${zeynep.isim} ${zeynep.soyisim})`)

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
    console.log("  Pilots:")
    console.log("    pilot.kerem@bonair.local / bonair2025")
    console.log("    pilot.seda@bonair.local / bonair2025")
    console.log("    pilot.emre@bonair.local / bonair2025")
    console.log("    pilot.buse@bonair.local / bonair2025")
    console.log("    pilot.onur@bonair.local / bonair2025")
    console.log("\n⚠️ Hazard Reports:")
    console.log("  Created 8 sample hazard reports in the database")
    
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

