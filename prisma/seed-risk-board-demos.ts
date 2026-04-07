/**
 * Örnek: 3 risk, bow-tie (threat/consequence + bariyerler), 2 MeetingTask (Current / In Progress),
 * ayrıntılı boardHistory. Mevcut demo satırlarını (aynı id / riskKey) yeniden yazar.
 *
 * Çalıştırma: pnpm prisma db push && pnpm db:seed:risk-demos
 * Önkoşul: DATABASE_URL; `safety_risk_boards` + `board_history` kolonu (db push).
 * En az bir çalışan önerilir (görev assignee). Toplantı yoksa betik demo toplantısı oluşturur.
 */
import { config } from "dotenv"
import { resolve } from "path"
import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { existsSync } from "fs"

import { riskBoardKeyFromTitle } from "../lib/safety-risk-board-key"
import { riskBoardCatalogEntriesSchema } from "../lib/safety-risk-catalog-schema"

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

const TITLE_ALPHA = "Demo Risk Alpha — Hydraulic line leak on stand"
const TITLE_BETA = "Demo Risk Beta — EFB chart not updated before departure"
const TITLE_GAMMA = "Demo Risk Gamma — Tool FOD in hangar bay 2"

const TASK_TITLE_COMPLETED =
  "Hydraulic accumulator pressure check completed and signed off"
const TASK_TITLE_IN_PROGRESS =
  "Operational readiness review — follow-up actions in progress"

const DEMO_CATALOG_IDS = ["demo-cat-alpha", "demo-cat-beta", "demo-cat-gamma"] as const

function demoHistoryAlpha() {
  return [
    {
      id: "h-a-1",
      date: "2026-04-01",
      message:
        "Risk kaydı oluşturuldu; olay: apron üzerinde hidrolik hat bağlantısında nem ve hafif sızdırma.",
      actor: "Safety Office",
    },
    {
      id: "h-a-2",
      date: "2026-04-01",
      message:
        "İlk değerlendirme: olasılık 4, şiddet C — matris üzerinde sarı bant.",
      actor: "Quality — A. Yılmaz",
    },
    {
      id: "h-a-3",
      date: "2026-04-02",
      message:
        "Bakım ekibi günlük kontrol listesini tamamladı; basınç değerleri nominal aralıkta.",
      actor: "Maintenance",
    },
    {
      id: "h-a-4",
      date: "2026-04-02",
      message:
        "Tehdit “Hidrolik biriktirici yorgunluk / conta kaçağı” için bariyer eklendi ve göreve bağlandı.",
      actor: "Safety Office",
    },
    {
      id: "h-a-5",
      date: "2026-04-03",
      message:
        "Sonuç “Uçak grounding / gecikme” için ikinci bariyer oluşturuldu; aksiyon görevi açık.",
      actor: "Ops Control",
    },
    {
      id: "h-a-6",
      date: "2026-04-04",
      message:
        "Tamamlanan görev: hidrolik biriktirici kontrolü — durum Completed (Current).",
      actor: "Maintenance Supervisor",
    },
    {
      id: "h-a-7",
      date: "2026-04-05",
      message:
        "Operasyonel hazırlık incelemesi devam ediyor; ilgili görev In Progress olarak izleniyor.",
      actor: "Ops Control",
    },
    {
      id: "h-a-8",
      date: "2026-04-05",
      message:
        "SPI-04 kapsamında kısa brifing: kaçak senaryosu ve izolasyon prosedürü hatırlandı.",
      actor: "Training",
    },
    {
      id: "h-a-9",
      date: "2026-04-06",
      message:
        "Final değerlendirme taslağı: kalan aksiyon kapanınca 2D hedefi kaydedilecek.",
      actor: "Quality",
    },
    {
      id: "h-a-10",
      date: "2026-04-06",
      message:
        "Yönetim özeti: iki bariyerden biri kapalı (Current), biri aktif takip (In Progress).",
      actor: "Accountable Manager",
    },
  ]
}

function demoHistoryBeta() {
  return [
    {
      id: "h-b-1",
      date: "2026-04-02",
      message:
        "EFB senkronizasyonu gecikti; chart revision uçuş öncesi doğrulanamadı.",
      actor: "FO Dept",
    },
    {
      id: "h-b-2",
      date: "2026-04-02",
      message:
        "Tehdit eklendi: mürettebat eski navigasyon verisine güvenebilir.",
      actor: "Safety Office",
    },
    {
      id: "h-b-3",
      date: "2026-04-03",
      message:
        "Sonuç hattı: yanlış rota / arazi çatışması riski — bariyer olarak çapraz kontrol prosedürü not edildi.",
      actor: "Quality",
    },
    {
      id: "h-b-4",
      date: "2026-04-03",
      message:
        "İlk olasılık / şiddet seçimi yapıldı (3D); ekip bilgilendirildi.",
      actor: "Chief Pilot",
    },
    {
      id: "h-b-5",
      date: "2026-04-04",
      message:
        "SPI-11 referansı ile EFB değişiklik yönetimi kontrol listesi gözden geçirildi.",
      actor: "Compliance",
    },
  ]
}

function demoHistoryGamma() {
  return [
    {
      id: "h-g-1",
      date: "2026-03-28",
      message:
        "Hangar 2’de FOD tespiti; süpürme sonrası parça kaynağı aranıyor.",
      actor: "Hangar Lead",
    },
    {
      id: "h-g-2",
      date: "2026-03-29",
      message:
        "Tehdit: süpürme atlanırsa yabancı cisim motor bölgesine girebilir.",
      actor: "Safety Office",
    },
    {
      id: "h-g-3",
      date: "2026-03-29",
      message:
        "İki sonuç kolu tanımlandı: motor hasarı ve program kayması.",
      actor: "Maintenance Planning",
    },
    {
      id: "h-g-4",
      date: "2026-03-30",
      message:
        "Günlük FOD yürüyüşü frekansı geçici olarak iki katına çıkarıldı.",
      actor: "Base Manager",
    },
    {
      id: "h-g-5",
      date: "2026-03-31",
      message:
        "Bow-tie üzerinde bariyer kutuları fallback notlarıyla güncellendi.",
      actor: "Quality",
    },
    {
      id: "h-g-6",
      date: "2026-04-01",
      message:
        "Kıyas risk seviyesi: başlangıç 5C, hedef ALARP altına çekme çalışması sürüyor.",
      actor: "Risk Owner",
    },
  ]
}

async function getOrCreateDemoMeetingId(): Promise<number> {
  const existing = await prisma.meeting.findFirst({
    orderBy: { id: "asc" },
    select: { id: true },
  })
  if (existing) return existing.id
  const mt = await prisma.meetingType.findFirst({ select: { id: true } })
  const m = await prisma.meeting.create({
    data: {
      meetingNo: `BON-DEMO-${Date.now()}`,
      title: "Risk board demo — linked tasks",
      plannedDate: new Date("2026-04-07"),
      status: "Planned",
      ...(mt ? { meetingTypeId: mt.id } : {}),
    },
  })
  return m.id
}

async function main() {
  await prisma.$connect()
  console.log("Connected. Seeding risk board demos…")

  const calisan = await prisma.calisan.findFirst({ select: { id: true } })
  const assigneeId = calisan?.id ?? null

  const demoMeetingId = await getOrCreateDemoMeetingId()

  await prisma.meetingTask.deleteMany({
    where: {
      title: { in: [TASK_TITLE_COMPLETED, TASK_TITLE_IN_PROGRESS] },
    },
  })

  const taskDone = await prisma.meetingTask.create({
    data: {
      title: TASK_TITLE_COMPLETED,
      status: "Completed",
      meetingId: demoMeetingId,
      assigneeId,
    },
  })

  const taskProgress = await prisma.meetingTask.create({
    data: {
      title: TASK_TITLE_IN_PROGRESS,
      status: "In Progress",
      meetingId: demoMeetingId,
      assigneeId,
    },
  })

  const keyAlpha = riskBoardKeyFromTitle(TITLE_ALPHA)
  const keyBeta = riskBoardKeyFromTitle(TITLE_BETA)
  const keyGamma = riskBoardKeyFromTitle(TITLE_GAMMA)

  const openAll = (ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, true] as const))

  const boardAlpha = {
    riskKey: keyAlpha,
    riskTitle: TITLE_ALPHA,
    probability: 4,
    severity: "C",
    initialProbability: 4,
    initialSeverity: "C",
    finalProbability: 2,
    finalSeverity: "D",
    threats: [
      {
        id: "demo-a-t1",
        label: "Hidrolik biriktirici yorgunluk / conta kaçağı",
        reference: "#DEMO-A-T1",
        barriers: [
          {
            id: "demo-a-b1",
            text: TASK_TITLE_COMPLETED,
            recordedAt: "2026-04-01",
            linkedTaskId: taskDone.id,
            linkedMeetingId: demoMeetingId,
          },
        ],
        fallbackNote: "",
      },
    ],
    consequences: [
      {
        id: "demo-a-c1",
        label: "Uçak grounding / operasyonel gecikme",
        reference: "#DEMO-A-C1",
        barriers: [
          {
            id: "demo-a-b2",
            text: TASK_TITLE_IN_PROGRESS,
            recordedAt: "2026-04-02",
            linkedTaskId: taskProgress.id,
            linkedMeetingId: demoMeetingId,
          },
        ],
        fallbackNote: "",
      },
    ],
    threatOpenById: openAll(["demo-a-t1"]),
    consequenceOpenById: openAll(["demo-a-c1"]),
    boardHistory: demoHistoryAlpha(),
  }

  const boardBeta = {
    riskKey: keyBeta,
    riskTitle: TITLE_BETA,
    probability: 3,
    severity: "D",
    initialProbability: 3,
    initialSeverity: "D",
    finalProbability: null,
    finalSeverity: null,
    threats: [
      {
        id: "demo-b-t1",
        label: "Mürettebat eski navigasyon verisine güvenebilir",
        reference: "#DEMO-B-T1",
        barriers: [
          {
            id: "demo-b-b1",
            text: "Çift pilot EFB çapraz kontrolü — departure öncesi zorunlu",
            recordedAt: "2026-04-02",
          },
        ],
        fallbackNote: "",
      },
    ],
    consequences: [
      {
        id: "demo-b-c1",
        label: "Yanlış rota / arazi çatışması",
        reference: "#DEMO-B-C1",
        barriers: [],
        fallbackNote:
          "ATC koordinasyonu ve alternatif alan netliği sağlanana kadar release ertelenir.",
      },
    ],
    threatOpenById: openAll(["demo-b-t1"]),
    consequenceOpenById: openAll(["demo-b-c1"]),
    boardHistory: demoHistoryBeta(),
  }

  const boardGamma = {
    riskKey: keyGamma,
    riskTitle: TITLE_GAMMA,
    probability: 5,
    severity: "C",
    initialProbability: 5,
    initialSeverity: "C",
    finalProbability: null,
    finalSeverity: null,
    threats: [
      {
        id: "demo-g-t1",
        label: "Süpürme atlanırsa yabancı cisim motor bölgesine girebilir",
        reference: "#DEMO-G-T1",
        barriers: [],
        fallbackNote:
          "Hangar girişinde FOD sepeti ve manyetik bar kontrolü; shift başı imza.",
      },
    ],
    consequences: [
      {
        id: "demo-g-c1",
        label: "Motor hasarı / güvenlik olayı",
        reference: "#DEMO-G-C1",
        barriers: [],
        fallbackNote: "Motor borescope ve trend izleme prosedürü devreye alınır.",
      },
      {
        id: "demo-g-c2",
        label: "Program kayması / hat etkinliği düşüşü",
        reference: "#DEMO-G-C2",
        barriers: [],
        fallbackNote: "Recovery planı: yedek uçak ve mürettebat rezervi.",
      },
    ],
    threatOpenById: openAll(["demo-g-t1"]),
    consequenceOpenById: openAll(["demo-g-c1", "demo-g-c2"]),
    boardHistory: demoHistoryGamma(),
  }

  const boards = [boardAlpha, boardBeta, boardGamma]

  for (const b of boards) {
    await prisma.safetyRiskBoard.upsert({
      where: { riskKey: b.riskKey },
      create: {
        riskKey: b.riskKey,
        riskTitle: b.riskTitle,
        probability: b.probability,
        severity: b.severity,
        initialProbability: b.initialProbability,
        initialSeverity: b.initialSeverity,
        finalProbability: b.finalProbability,
        finalSeverity: b.finalSeverity,
        threats: b.threats,
        consequences: b.consequences,
        threatOpenById: b.threatOpenById,
        consequenceOpenById: b.consequenceOpenById,
        boardHistory: b.boardHistory,
        updatedByCalisanId: assigneeId,
      },
      update: {
        riskTitle: b.riskTitle,
        probability: b.probability,
        severity: b.severity,
        initialProbability: b.initialProbability,
        initialSeverity: b.initialSeverity,
        finalProbability: b.finalProbability,
        finalSeverity: b.finalSeverity,
        threats: b.threats,
        consequences: b.consequences,
        threatOpenById: b.threatOpenById,
        consequenceOpenById: b.consequenceOpenById,
        boardHistory: b.boardHistory,
        updatedByCalisanId: assigneeId,
      },
    })
  }

  const catalogRows = [
    {
      id: "demo-cat-alpha",
      riskNo: "BON-SR-DEMO-001",
      date: "2026-04-01",
      title: TITLE_ALPHA,
      titleDot: "amber" as const,
      initial: "4C",
      final: "2D",
      field: "Maintenance",
      threads:
        "Tehdit bariyeri → Completed görev; sonuç bariyeri → In Progress görev (örnek).",
      threadsHighlight: true,
      status: "Awaiting Mitigation",
      statusTone: "mitigation" as const,
    },
    {
      id: "demo-cat-beta",
      riskNo: "BON-SR-DEMO-002",
      date: "2026-04-02",
      title: TITLE_BETA,
      titleDot: "red" as const,
      initial: "3D",
      final: "Not Determined",
      field: "Flight Operation Dept",
      threads: "EFB senkron ve çapraz kontrol vurgusu.",
      threadsHighlight: false,
      status: "Awaiting Assessment",
      statusTone: "awaiting" as const,
    },
    {
      id: "demo-cat-gamma",
      riskNo: "BON-SR-DEMO-003",
      date: "2026-03-28",
      title: TITLE_GAMMA,
      titleDot: "green" as const,
      initial: "5C",
      final: "Not Determined",
      field: "Hangar / Ground Ops",
      threads: "İkili sonuç kolu; FOD süreç notları.",
      threadsHighlight: true,
      status: "To be Monitored",
      statusTone: "monitored" as const,
    },
  ]

  const existing = await prisma.safetyRiskBoardCatalog.findUnique({
    where: { id: 1 },
  })
  let merged: unknown[] = []
  if (existing?.entries) {
    const parsed = riskBoardCatalogEntriesSchema.safeParse(existing.entries)
    if (parsed.success) {
      const drop = new Set<string>([...DEMO_CATALOG_IDS])
      merged = parsed.data.filter((row) => !drop.has(row.id))
    }
  }
  merged = [...merged, ...catalogRows]
  const validated = riskBoardCatalogEntriesSchema.parse(merged)

  await prisma.safetyRiskBoardCatalog.upsert({
    where: { id: 1 },
    create: { id: 1, entries: validated },
    update: { entries: validated },
  })

  console.log("Done.")
  console.log(`  Tasks: #${taskDone.id} (Completed), #${taskProgress.id} (In Progress)`)
  console.log("  Boards:", boards.map((b) => b.riskKey).join(" | "))
  console.log("  Catalog: 3 demo rows merged into safety_risk_board_catalog.")
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
