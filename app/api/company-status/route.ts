import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { Prisma } from "@prisma/client"

const VALID_LOCATIONS = ["Office", "Hangar", "Remote", "Field", "OnDuty"] as const
type WorkLocation = (typeof VALID_LOCATIONS)[number]

function parseDate(raw: unknown): Date | null {
  if (!raw || typeof raw !== "string") return null
  const s = raw.trim()
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T12:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

// ─── GET /api/company-status?date=YYYY-MM-DD ─────────────────────────────────
// Belirli bir tarihteki konum geçmişini döndürür.
// Her çalışan için o tarihe kadar kaydedilmiş en son log kaydı alınır.
// Log yoksa mevcut workLocation kullanılır (fallback).

type LogRow = { employee_id: bigint | number; work_location: string }

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get("date")
  const targetDate = parseDate(dateParam)

  if (!targetDate) {
    return NextResponse.json({ error: "Geçerli bir tarih gönderin (YYYY-MM-DD)." }, { status: 400 })
  }

  // DISTINCT ON: her çalışan için targetDate'e kadar en son log kaydı
  const logs = await prisma.$queryRaw<LogRow[]>`
    SELECT DISTINCT ON (employee_id)
      employee_id,
      work_location
    FROM company_status_logs
    WHERE status_date <= ${targetDate}::date
    ORDER BY employee_id, status_date DESC, created_at DESC
  `

  // Tüm aktif çalışanları çek (izin bilgisiyle birlikte)
  const today = new Date()
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))

  const [employees, activeLeaves] = await Promise.all([
    prisma.calisan.findMany({
      where: { istenCikisTarihi: null },
      select: {
        id: true,
        isim: true,
        soyisim: true,
        departman: true,
        workLocation: true,
        workLocationDate: true,
        title: { select: { titleName: true, isManager: true } },
      },
      orderBy: [{ departman: "asc" }, { isim: "asc" }],
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: todayUTC },
        endDate: { gte: todayUTC },
      },
      select: { employeeId: true },
    }),
  ])

  const onLeaveIds = new Set(activeLeaves.map((l) => l.employeeId))

  // Log map: employeeId → workLocation
  const logMap = new Map<number, string>()
  for (const row of logs) {
    logMap.set(Number(row.employee_id), row.work_location)
  }

  const result = employees.map((emp) => ({
    id: emp.id,
    isim: emp.isim,
    soyisim: emp.soyisim,
    departman: emp.departman,
    titleName: emp.title?.titleName ?? null,
    isManager: emp.title?.isManager ?? false,
    // Log varsa log'dan, yoksa mevcut workLocation'dan al
    workLocation: logMap.get(emp.id) ?? emp.workLocation ?? "Office",
    workLocationDate: emp.workLocationDate
      ? emp.workLocationDate.toISOString().slice(0, 10)
      : null,
    isOnLeave: onLeaveIds.has(emp.id),
    // Log'da kayıt var mı?
    hasLog: logMap.has(emp.id),
  }))

  return NextResponse.json({ date: dateParam, employees: result })
}

// ─── PATCH /api/company-status — çalışan kendi konumunu günceller ─────────────

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 })
  }

  const location = typeof body.workLocation === "string" ? body.workLocation : ""
  if (!VALID_LOCATIONS.includes(location as WorkLocation)) {
    return NextResponse.json(
      { error: `Geçersiz konum. Geçerli değerler: ${VALID_LOCATIONS.join(", ")}` },
      { status: 400 }
    )
  }

  const locationDate = parseDate(body.workLocationDate)

  // E-posta ile çalışanı bul
  const calisan = await prisma.calisan.findFirst({
    where: {
      email: { equals: session.user.email, mode: "insensitive" },
      istenCikisTarihi: null,
    },
    select: { id: true },
  })

  if (!calisan) {
    return NextResponse.json({ error: "Çalışan kaydı bulunamadı." }, { status: 404 })
  }

  // Log tarihi: seçilen tarih varsa o, yoksa bugün
  const logDate = locationDate ?? new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
  )

  // Güncelle + log ekle (transaction)
  const [updated] = await prisma.$transaction([
    prisma.calisan.update({
      where: { id: calisan.id },
      data: {
        workLocation: location,
        workLocationDate: locationDate,
      },
      select: { id: true, workLocation: true, workLocationDate: true },
    }),
    prisma.companyStatusLog.create({
      data: {
        employeeId: calisan.id,
        workLocation: location,
        statusDate: logDate,
      },
    }),
  ])

  return NextResponse.json({
    ...updated,
    workLocationDate: updated.workLocationDate
      ? updated.workLocationDate.toISOString().slice(0, 10)
      : null,
  })
}
