import { config } from "dotenv"
import { resolve } from "path"
import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import { existsSync } from "fs"

const envLocalPath = resolve(process.cwd(), ".env.local")
const envPath = resolve(process.cwd(), ".env")
config({ path: existsSync(envLocalPath) ? envLocalPath : envPath })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL is not set.")
}

const cleanConnectionString = connectionString.startsWith("prisma+postgres://")
  ? connectionString.replace("prisma+postgres://", "postgresql://")
  : connectionString

const pool = new Pool({
  connectionString: cleanConnectionString,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
})

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: ["error", "warn"],
})

async function clearAllData() {
  await prisma.$transaction(async (tx) => {
    await tx.hazardAttachment.deleteMany()
    await tx.aircraftDocument.deleteMany()
    await tx.meetingTask.deleteMany()
    await tx.meetingParticipant.deleteMany()
    await tx.meeting.deleteMany()
    await tx.hazardReport.deleteMany()
    await tx.announcement.deleteMany()
    await tx.incomingPaper.deleteMany()
    await tx.outgoingCorrespondence.deleteMany()
    await tx.ucaklar.deleteMany()
    await tx.meetingType.deleteMany()
    await tx.calisan.deleteMany()
    await tx.session.deleteMany()
    await tx.account.deleteMany()
    await tx.user.deleteMany()
    await tx.verificationToken.deleteMany()
  })
  console.log("Cleared all application tables.")
}

async function main() {
  await prisma.$connect()
  console.log("Database connected.")

  await clearAllData()

  const pwd = await bcrypt.hash("bonair2025", 10)

  const asya = await prisma.calisan.create({
    data: {
      isim: "Asya",
      soyisim: "Temur",
      email: "atemur@gmail.com",
      departman: "Quality",
      password: pwd,
      telNo: "+90 555 000 0001",
      dogumTarihi: new Date("1990-06-15"),
      medeniDurum: "Married",
      cocuk: 0,
      kanGrubu: "A+",
      iseGirisTarihi: new Date("2020-01-01"),
    },
  })

  await prisma.calisan.create({
    data: {
      isim: "Mert",
      soyisim: "Sirmali",
      email: "sirmalimert@gmail.com",
      departman: "Quality",
      password: pwd,
      telNo: "+90 555 000 0002",
      dogumTarihi: new Date("1992-03-20"),
      medeniDurum: "Single",
      cocuk: 0,
      kanGrubu: "O+",
      iseGirisTarihi: new Date("2021-06-01"),
    },
  })

  const hr = await prisma.calisan.create({
    data: {
      isim: "Sarah",
      soyisim: "Jones",
      email: "hr.sample@bonair.demo",
      departman: "Human Resources",
      password: pwd,
      iseGirisTarihi: new Date("2019-03-01"),
    },
  })

  const eng = await prisma.calisan.create({
    data: {
      isim: "James",
      soyisim: "Wilson",
      email: "engineering.sample@bonair.demo",
      departman: "Engineering",
      password: pwd,
      iseGirisTarihi: new Date("2018-06-01"),
    },
  })

  const pilot = await prisma.calisan.create({
    data: {
      isim: "Alex",
      soyisim: "Morgan",
      email: "pilot.sample@bonair.demo",
      departman: "Pilot",
      password: pwd,
      ekstra3: "Captain",
      iseGirisTarihi: new Date("2015-01-10"),
    },
  })

  const ac1 = await prisma.ucaklar.create({
    data: { register: "TC-ABC", msn: "12345" },
  })
  const ac2 = await prisma.ucaklar.create({
    data: { register: "TC-XYZ", msn: "67890" },
  })

  const mt = await prisma.meetingType.create({
    data: { name: "Safety Review" },
  })

  const today = new Date()
  const planned = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1
  )

  await prisma.meeting.create({
    data: {
      meetingNo: "MTG-001",
      title: "Monthly safety briefing",
      plannedDate: planned,
      isOnline: false,
      agenda: "Review open hazards and action items.",
      meetingTypeId: mt.id,
      status: "Planned",
    },
  })

  await prisma.hazardReport.create({
    data: {
      reportNo: "BON-HR-001",
      eventDate: new Date(
        today.getFullYear(),
        today.getMonth(),
        Math.max(1, today.getDate() - 2)
      ),
      sourceType: "Safety Observation",
      isAnonymous: false,
      title: "Wet floor near hangar entrance",
      details:
        "Water accumulation observed after cleaning. Temporary signage recommended.",
      reportedBy: asya.id,
    },
  })

  await prisma.hazardReport.create({
    data: {
      reportNo: "BON-HR-002",
      eventDate: today,
      sourceType: "Near Miss",
      isAnonymous: false,
      title: "Loose tool cart on ramp",
      details:
        "Unsecured cart moved in light wind. Secure parking area suggested.",
      reportedBy: eng.id,
    },
  })

  await prisma.announcement.create({
    data: {
      title: "Welcome to the new SMS portal",
      content:
        "This is sample data after a fresh seed. Please replace with your own announcements.",
      createdBy: hr.id,
    },
  })

  console.log("\nSeed completed.")
  console.log("Primary logins (kept): atemur@gmail.com, sirmalimert@gmail.com / bonair2025")
  console.log("Demo users: hr.sample@bonair.demo, engineering.sample@bonair.demo, pilot.sample@bonair.demo / bonair2025")
  console.log(`Aircraft: ${ac1.register}, ${ac2.register}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
