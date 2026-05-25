import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import {
  parseIsoDate,
  resolveStatusDateRange,
} from "@/lib/company-status-dates"

const VALID_LOCATIONS = ["Office", "Hangar", "Remote", "Field", "OnDuty"] as const
type WorkLocation = (typeof VALID_LOCATIONS)[number]

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
  const targetDate = parseIsoDate(dateParam)

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
        workLocationDateEnd: true,
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
    workLocationDateEnd: emp.workLocationDateEnd
      ? emp.workLocationDateEnd.toISOString().slice(0, 10)
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

  const range = resolveStatusDateRange(
    body.workLocationDate,
    body.workLocationDateEnd
  )
  if (!range.ok) {
    const messages: Record<string, string> = {
      RANGE_END_BEFORE_START:
        "Bitiş tarihi başlangıç tarihinden önce olamaz.",
      RANGE_END_WITHOUT_START: "Önce başlangıç tarihini seçin.",
      RANGE_TOO_LONG: "En fazla 90 günlük aralık seçebilirsiniz.",
    }
    return NextResponse.json(
      { error: messages[range.error] ?? "Geçersiz tarih aralığı." },
      { status: 400 }
    )
  }

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

  // Güncelle + her gün için log ekle (transaction)
  const [updated] = await prisma.$transaction([
    prisma.calisan.update({
      where: { id: calisan.id },
      data: {
        workLocation: location,
        workLocationDate: range.start,
        workLocationDateEnd: range.end,
      },
      select: {
        id: true,
        workLocation: true,
        workLocationDate: true,
        workLocationDateEnd: true,
      },
    }),
    ...range.days.map((day) =>
      prisma.companyStatusLog.create({
        data: {
          employeeId: calisan.id,
          workLocation: location,
          statusDate: day,
        },
      })
    ),
  ])

  return NextResponse.json({
    ...updated,
    workLocationDate: updated.workLocationDate
      ? updated.workLocationDate.toISOString().slice(0, 10)
      : null,
    workLocationDateEnd: updated.workLocationDateEnd
      ? updated.workLocationDateEnd.toISOString().slice(0, 10)
      : null,
  })
}
