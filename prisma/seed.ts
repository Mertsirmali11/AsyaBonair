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
      telNo: "+90 555 100 0001",
      dogumTarihi: new Date("1990-06-15"),
      medeniDurum: "Evli",
      cocuk: 0,
      kanGrubu: "A+",
      iseGirisTarihi: new Date("2020-01-01"),
    },
  })

  const mert = await prisma.calisan.create({
    data: {
      isim: "Mert",
      soyisim: "Sirmali",
      email: "sirmalimert@gmail.com",
      departman: "Quality",
      password: pwd,
      telNo: "+90 555 100 0002",
      dogumTarihi: new Date("1992-03-20"),
      medeniDurum: "Bekar",
      cocuk: 0,
      kanGrubu: "O+",
      iseGirisTarihi: new Date("2021-06-01"),
    },
  })

  const hr = await prisma.calisan.create({
    data: {
      isim: "Ayşe",
      soyisim: "Yılmaz",
      email: "ik.ornek@bonair.demo",
      departman: "Human Resources",
      password: pwd,
      telNo: "+90 555 200 0001",
      iseGirisTarihi: new Date("2015-04-12"),
    },
  })

  const eng = await prisma.calisan.create({
    data: {
      isim: "Mehmet",
      soyisim: "Kaya",
      email: "muhendislik.ornek@bonair.demo",
      departman: "Engineering",
      password: pwd,
      telNo: "+90 555 300 0001",
      iseGirisTarihi: new Date("2017-09-01"),
    },
  })

  const pilot1 = await prisma.calisan.create({
    data: {
      isim: "Can",
      soyisim: "Öztürk",
      email: "pilot.kaptan@bonair.demo",
      departman: "Pilot",
      password: pwd,
      ekstra1: "TC-JMK",
      ekstra3: "Captain",
      telNo: "+90 555 400 0001",
      iseGirisTarihi: new Date("2015-01-10"),
    },
  })

  const maint = await prisma.calisan.create({
    data: {
      isim: "Elif",
      soyisim: "Demir",
      email: "bakim.ornek@bonair.demo",
      departman: "Maintenance",
      password: pwd,
      telNo: "+90 555 500 0001",
      iseGirisTarihi: new Date("2019-03-18"),
    },
  })

  const pilot2 = await prisma.calisan.create({
    data: {
      isim: "Burak",
      soyisim: "Şahin",
      email: "pilot.fo@bonair.demo",
      departman: "Pilot",
      password: pwd,
      ekstra1: "TC-ANK",
      ekstra3: "F/O",
      telNo: "+90 555 400 0002",
      iseGirisTarihi: new Date("2018-11-05"),
    },
  })

  const aircraft = await prisma.$transaction([
    prisma.ucaklar.create({ data: { register: "TC-JMK", msn: "MSN-45001" } }),
    prisma.ucaklar.create({ data: { register: "TC-ANK", msn: "MSN-45002" } }),
    prisma.ucaklar.create({ data: { register: "TC-IZM", msn: "MSN-45003" } }),
    prisma.ucaklar.create({ data: { register: "TC-ADB", msn: "MSN-45004" } }),
    prisma.ucaklar.create({ data: { register: "TC-ERZ", msn: "MSN-45005" } }),
  ])

  const mtGuvenlik = await prisma.meetingType.create({
    data: { name: "Güvenlik İncelemesi" },
  })
  const mtOperasyon = await prisma.meetingType.create({
    data: { name: "Operasyonel Brifing" },
  })
  const mtKalite = await prisma.meetingType.create({
    data: { name: "Kalite Değerlendirme" },
  })

  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  const d = today.getDate()

  const tomorrow = new Date(y, m, d + 1)
  const inThreeDays = new Date(y, m, d + 3)
  const nextWeek = new Date(y, m, d + 7)

  const meeting1 = await prisma.meeting.create({
    data: {
      meetingNo: "TOPL-2026-001",
      title: "Aylık güvenlik brifingi ve açık aksiyonlar",
      plannedDate: tomorrow,
      initializedDate: new Date(),
      isOnline: false,
      agenda:
        "1) Açık tehlike kayıtları\n2) Son denetim bulguları\n3) Yeni prosedürler\n4) Soru-cevap",
      meetingTypeId: mtGuvenlik.id,
      status: "Planned",
    },
  })

  const meeting2 = await prisma.meeting.create({
    data: {
      meetingNo: "TOPL-2026-002",
      title: "Kış operasyonları hazırlık toplantısı",
      plannedDate: inThreeDays,
      isOnline: true,
      agenda:
        "Meteoroloji bilgisi, pist bakım planı, mürettebat görevleri ve alternatif meydanlar.",
      meetingTypeId: mtOperasyon.id,
      status: "Planned",
    },
  })

  const meeting3 = await prisma.meeting.create({
    data: {
      meetingNo: "TOPL-2026-003",
      title: "SMS kalite göstergeleri (KPI) değerlendirmesi",
      plannedDate: nextWeek,
      isOnline: false,
      agenda:
        "Raporlama süreleri, müşteri geri bildirimleri ve düzeltici faaliyetlerin özeti.",
      meetingTypeId: mtKalite.id,
      status: "Planned",
    },
  })

  const meeting4 = await prisma.meeting.create({
    data: {
      meetingNo: "TOPL-2026-004",
      title: "Hızlı güvenlik turu (hangar)",
      plannedDate: new Date(y, m, d),
      initializedDate: new Date(y, m, d - 1),
      isOnline: false,
      agenda: "Gezinti rotası, fotoğraf çekimi yasağı ve ziyaretçi yelekleri.",
      meetingTypeId: mtGuvenlik.id,
      status: "Completed",
      actualDate: new Date(y, m, d),
      meetingMinutes:
        "Tur tamamlandı. Yangın söndürücü kontrolleri not edildi; ek eğitim planlanacak.",
    },
  })

  await prisma.meetingParticipant.createMany({
    data: [
      { meetingId: meeting1.id, calisanId: asya.id },
      { meetingId: meeting1.id, calisanId: mert.id },
      { meetingId: meeting1.id, calisanId: hr.id },
      { meetingId: meeting2.id, calisanId: pilot1.id },
      { meetingId: meeting2.id, calisanId: pilot2.id },
      { meetingId: meeting2.id, calisanId: eng.id },
      { meetingId: meeting3.id, calisanId: asya.id },
      { meetingId: meeting3.id, calisanId: hr.id },
      { meetingId: meeting4.id, calisanId: maint.id },
    ],
  })

  await prisma.hazardReport.create({
    data: {
      reportNo: "BON-HR-001",
      eventDate: new Date(y, m, Math.max(1, d - 2)),
      sourceType: "Güvenlik Gözlemi",
      isAnonymous: false,
      title: "Hangar girişinde kaygan zemin",
      details:
        "Temizlik sonrası su birikintisi tespit edildi. Geçici uyarı levhası önerilir.",
      reportedBy: asya.id,
    },
  })

  await prisma.hazardReport.create({
    data: {
      reportNo: "BON-HR-002",
      eventDate: new Date(y, m, d),
      sourceType: "Ramak Kala",
      isAnonymous: false,
      title: "Apronda sabitlenmemiş araç",
      details:
        "Hafif rüzgârda hareket eden servis arabası. Park alanı işaretlemesi talep edildi.",
      reportedBy: eng.id,
    },
  })

  await prisma.hazardReport.create({
    data: {
      reportNo: "BON-HR-003",
      eventDate: new Date(y, m, Math.max(1, d - 1)),
      sourceType: "Tehlike Belirleme",
      isAnonymous: false,
      title: "Gece vardiyasında aydınlatma eksikliği",
      details: "Bakım bölgesi bir bölümünde yarıkaranlık. LED armatür eklenmesi önerildi.",
      reportedBy: mert.id,
    },
  })

  await prisma.announcement.createMany({
    data: [
      {
        title: "Yıllık sağlık taraması randevuları",
        content:
          "Değerli çalışanlar,\nİK birimi olarak yıllık sağlık taraması randevuları Şubat ayı içinde alınacaktır. Tarih seçimi için İK portalına giriş yapınız.\nİyi çalışmalar.",
        createdBy: hr.id,
      },
      {
        title: "SMS portalı güncellemesi",
        content:
          "Tehlike raporu ve toplantı modülleri yenilendi. Kısa video eğitimleri intranet üzerinden yayında.",
        createdBy: asya.id,
      },
      {
        title: "Kış sezonu operasyon hatırlatması",
        content:
          "Değişken mevsim koşullarında pushback ve taksi sürelerinde ek süre planlayınız. Brifing notları e-posta ile iletildi.",
        createdBy: mert.id,
      },
      {
        title: "Hangar ziyaretçi kuralları",
        content:
          "Ziyaretçiler yalnızca refakatçi eşliğinde ve yelek ile hangara alınacaktır. İhlaller güvenlik birimine bildirilecektir.",
        createdBy: hr.id,
      },
    ],
  })

  console.log("\nSeed tamamlandı.")
  console.log("Sabit girişler: atemur@gmail.com, sirmalimert@gmail.com / bonair2025")
  console.log(
    "Örnek hesaplar: ik.ornek@bonair.demo, muhendislik.ornek@bonair.demo, pilot.kaptan@bonair.demo, bakim.ornek@bonair.demo, pilot.fo@bonair.demo / bonair2025"
  )
  console.log(
    `Uçaklar (${aircraft.length}): ${aircraft.map((a) => a.register).join(", ")}`
  )
  console.log(`Toplantılar: ${meeting1.meetingNo}, ${meeting2.meetingNo}, ${meeting3.meetingNo}, ${meeting4.meetingNo}`)
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
