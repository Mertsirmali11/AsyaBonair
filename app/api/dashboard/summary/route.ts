import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { prismaJson } from "@/lib/prisma-json"
import { findCalisanlarWithBirthdayOnCalendarDay } from "@/lib/birthdays-db"
import {
  APP_TIMEZONE,
  formatYmd,
  getCalendarYmdInTimeZone,
  getIstanbulLocalDayUtcRange,
  getUtcRangeForCalendarDate,
} from "@/lib/day-range"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"
import {
  meetingTaskAssigneeWhere,
  meetingTaskListVisibilityWhere,
} from "@/lib/meeting-task-access"
import { canManageSupportTicketsAsAdmin } from "@/lib/support-ticket-access"

const ANNOUNCEMENTS_DASHBOARD_LIMIT = 80
const SUPPORT_TICKETS_DASHBOARD_LIMIT = 10

/** İstanbul takvim günü için YYYY-MM-DD anahtarı (görevleri bugün / sonraki günlere ayırmak için). */
function ymdKeyIstanbul(d: Date): string {
  const { year, month, day } = getCalendarYmdInTimeZone(APP_TIMEZONE, d)
  return formatYmd(year, month, day)
}

function addCalendarDays(
  y: number,
  m: number,
  d: number,
  days: number
): { year: number; month: number; day: number } {
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  }
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const viewer = await prisma.calisan.findUnique({
      where: { email: session.user.email },
      select: { id: true, departman: true },
    })

    // Departman izinlerini çöz — sertifika görünürlüğü için
    const deptPermissions = await getResolvedDepartmentPermissionsForUser(
      viewer?.departman ?? session.user.departman
    )
    const canViewAircraftCerts =
      deptPermissions[DEPARTMENT_PERMISSION_KEYS.CONTROLLED_DOCUMENTS] ||
      deptPermissions[DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA]

    const canViewAllHazards =
      deptPermissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING] ||
      deptPermissions[DEPARTMENT_PERMISSION_KEYS.SAFETY_MANAGEMENT] ||
      deptPermissions[DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA]

    const canManageDocuments =
      deptPermissions[DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA]

    const canViewTraining =
      deptPermissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING]

    const { year, month, day } = getCalendarYmdInTimeZone(APP_TIMEZONE)
    const todayYmd = formatYmd(year, month, day)
    const todayStart = getUtcRangeForCalendarDate(year, month, day).start
    const dayStartUtc = new Date(Date.UTC(year, month - 1, day))
    const dayEndUtc = new Date(Date.UTC(year, month - 1, day + 1))

    const { start: hazardDayStart, end: hazardDayEnd } =
      getIstanbulLocalDayUtcRange(year, month, day)

    const end30 = addCalendarDays(year, month, day, 30)
    const certWindowEndDate = getUtcRangeForCalendarDate(
      end30.year,
      end30.month,
      end30.day
    ).start

    const [
      meetings,
      hazards,
      announcements,
      birthdays,
      tasksInWindow,
      certificateRows,
      certificateRowsExpired,
      trainingRowsExpiringSoon,
      trainingRowsExpired,
      pendingManualsCount,
      pendingFormsCount,
      supportTicketsPreview,
    ] = await Promise.all([
      prisma.meeting.findMany({
        where: {
          plannedDate: { gte: dayStartUtc, lt: dayEndUtc },
        },
        select: {
          id: true,
          meetingNo: true,
          title: true,
          plannedDate: true,
          status: true,
          meetingType: { select: { name: true } },
        },
        orderBy: { plannedDate: "asc" },
      }),
      viewer
        ? prisma.hazardReport.findMany({
            where: {
              createdAt: { gte: hazardDayStart, lt: hazardDayEnd },
              ...(canViewAllHazards
                ? {}
                : { reportedBy: viewer.id }),
            },
            select: {
              id: true,
              reportNo: true,
              title: true,
              eventDate: true,
              createdAt: true,
              sourceType: true,
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          })
        : Promise.resolve(
            [] as {
              id: number
              reportNo: string | null
              title: string | null
              eventDate: Date
              createdAt: Date
              sourceType: string | null
            }[]
          ),
      prisma.announcement.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: ANNOUNCEMENTS_DASHBOARD_LIMIT,
        select: {
          id: true,
          title: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          createdBy: true,
          creator: {
            select: { isim: true, soyisim: true, departman: true },
          },
        },
      }),
      findCalisanlarWithBirthdayOnCalendarDay(prisma, month, day),
      prisma.meetingTask.findMany({
        where: {
          status: { not: "Completed" },
          ...meetingTaskAssigneeWhere(
            viewer?.departman ?? session.user.departman,
            viewer?.id
          ),
          ...meetingTaskListVisibilityWhere(),
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          status: true,
          meeting: {
            select: { id: true, meetingNo: true, title: true },
          },
          assignee: {
            select: { isim: true, soyisim: true },
          },
        },
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        take: 120,
      }),
      canViewAircraftCerts
        ? prisma.aircraftDocument.findMany({
            where: {
              category: "certificate",
              isArchived: false,
              validUntil: {
                not: null,
                gte: todayStart,
                lte: certWindowEndDate,
              },
              aircraft: { isArchived: false },
            },
            select: {
              id: true,
              docType: true,
              fileName: true,
              validUntil: true,
              aircraft: {
                select: { id: true, register: true, msn: true },
              },
            },
            orderBy: { validUntil: "asc" },
            take: 50,
          })
        : Promise.resolve(
            [] as {
              id: number
              docType: string
              fileName: string
              validUntil: Date | null
              aircraft: { id: number; register: string; msn: string }
            }[]
          ),
      canViewAircraftCerts
        ? prisma.aircraftDocument.findMany({
            where: {
              category: "certificate",
              isArchived: false,
              validUntil: { not: null, lt: todayStart },
              aircraft: { isArchived: false },
            },
            select: {
              id: true,
              docType: true,
              fileName: true,
              validUntil: true,
              aircraft: {
                select: { id: true, register: true, msn: true },
              },
            },
            orderBy: { validUntil: "asc" },
            take: 50,
          })
        : Promise.resolve(
            [] as {
              id: number
              docType: string
              fileName: string
              validUntil: Date | null
              aircraft: { id: number; register: string; msn: string }
            }[]
          ),
      canViewTraining
        ? prisma.trainingRecord.findMany({
            where: {
              expiryDate: { not: null, gte: todayStart, lte: certWindowEndDate },
            },
            select: {
              id: true,
              calisanId: true,
              trainingName: true,
              expiryDate: true,
              calisan: { select: { isim: true, soyisim: true, departman: true } },
            },
            orderBy: { expiryDate: "asc" },
            take: 50,
          })
        : Promise.resolve(
            [] as {
              id: number
              calisanId: number
              trainingName: string
              expiryDate: Date | null
              calisan: { isim: string | null; soyisim: string | null; departman: string | null }
            }[]
          ),
      canViewTraining
        ? prisma.trainingRecord.findMany({
            where: { expiryDate: { not: null, lt: todayStart } },
            select: {
              id: true,
              calisanId: true,
              trainingName: true,
              expiryDate: true,
              calisan: { select: { isim: true, soyisim: true, departman: true } },
            },
            orderBy: { expiryDate: "asc" },
            take: 50,
          })
        : Promise.resolve(
            [] as {
              id: number
              calisanId: number
              trainingName: string
              expiryDate: Date | null
              calisan: { isim: string | null; soyisim: string | null; departman: string | null }
            }[]
          ),
      viewer && canManageDocuments
        ? prisma.companyManual.count({
            where: { status: "pending", isCurrent: true },
          })
        : Promise.resolve(0),
      viewer && canManageDocuments
        ? prisma.departmentForm.count({
            where: { status: "pending", isCurrent: true },
          })
        : Promise.resolve(0),
      viewer
        ? prisma.supportTicket.findMany({
            where: canManageSupportTicketsAsAdmin(viewer.departman)
              ? {}
              : { createdBy: viewer.id },
            orderBy: { createdAt: "desc" },
            take: SUPPORT_TICKETS_DASHBOARD_LIMIT,
            select: {
              id: true,
              subject: true,
              content: true,
              status: true,
              createdAt: true,
              creator: {
                select: {
                  isim: true,
                  soyisim: true,
                  email: true,
                  departman: true,
                },
              },
            },
          })
        : Promise.resolve(
            [] as {
              id: number
              subject: string | null
              content: string
              status: string
              createdAt: Date
              creator: {
                isim: string | null
                soyisim: string | null
                email: string
                departman: string | null
              }
            }[]
          ),
    ])

    const annIds = announcements.map((a) => a.id)
    let ackSet = new Set<number>()
    if (viewer && annIds.length > 0) {
      const mine = await prisma.announcementAcknowledgment.findMany({
        where: {
          calisanId: viewer.id,
          announcementId: { in: annIds },
        },
        select: { announcementId: true },
      })
      ackSet = new Set(mine.map((m) => m.announcementId))
    }

    const announcementsWithAck = announcements.map((a) => ({
      ...a,
      acknowledgedByMe: viewer ? ackSet.has(a.id) : false,
    }))

    const tasksDueToday: typeof tasksInWindow = []
    const tasksDueNext30Days: typeof tasksInWindow = []
    const tasksOverdue: typeof tasksInWindow = []
    const tasksNoDueDate: typeof tasksInWindow = []

    for (const t of tasksInWindow) {
      if (!t.dueDate) {
        tasksNoDueDate.push(t)
        continue
      }
      const k = ymdKeyIstanbul(t.dueDate)
      if (k < todayYmd) tasksOverdue.push(t)
      else if (k === todayYmd) tasksDueToday.push(t)
      else tasksDueNext30Days.push(t)
    }

    const todayUtcMs = Date.UTC(year, month - 1, day)
    const certificatesExpiringSoon = certificateRows.map((r) => {
        const v = r.validUntil!
        const untilUtc = Date.UTC(
          v.getUTCFullYear(),
          v.getUTCMonth(),
          v.getUTCDate()
        )
        const daysRemaining = Math.round((untilUtc - todayUtcMs) / 86400000)
        return {
          id: r.id,
          docType: r.docType,
          fileName: r.fileName,
          validUntil: v.toISOString(),
          daysRemaining,
          aircraft: r.aircraft,
        }
      })

    const certificatesExpired = certificateRowsExpired.map((r) => {
      const v = r.validUntil!
      const untilUtc = Date.UTC(
        v.getUTCFullYear(),
        v.getUTCMonth(),
        v.getUTCDate()
      )
      const daysExpired = Math.max(
        0,
        Math.round((todayUtcMs - untilUtc) / 86400000)
      )
      return {
        id: r.id,
        docType: r.docType,
        fileName: r.fileName,
        validUntil: v.toISOString(),
        daysExpired,
        aircraft: r.aircraft,
      }
    })

    const trainingExpiringSoon = trainingRowsExpiringSoon.map((r) => {
      const v = r.expiryDate!
      const untilUtc = Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate())
      const daysRemaining = Math.round((untilUtc - todayUtcMs) / 86400000)
      return {
        id: r.id,
        calisanId: r.calisanId,
        calisanName: `${r.calisan.isim ?? ""} ${r.calisan.soyisim ?? ""}`.trim(),
        department: r.calisan.departman,
        trainingName: r.trainingName,
        expiryDate: v.toISOString(),
        daysRemaining,
      }
    })

    const trainingExpired = trainingRowsExpired.map((r) => {
      const v = r.expiryDate!
      const untilUtc = Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate())
      const daysExpired = Math.max(0, Math.round((todayUtcMs - untilUtc) / 86400000))
      return {
        id: r.id,
        calisanId: r.calisanId,
        calisanName: `${r.calisan.isim ?? ""} ${r.calisan.soyisim ?? ""}`.trim(),
        department: r.calisan.departman,
        trainingName: r.trainingName,
        expiryDate: v.toISOString(),
        daysExpired,
      }
    })

    return NextResponse.json(
      prismaJson({
        announcements: announcementsWithAck,
        todayMeetings: meetings,
        todayHazards: hazards,
        birthdays,
        tasksDueToday,
        tasksDueNext30Days,
        tasksOverdue,
        tasksNoDueDate,
        certificatesExpiringSoon,
        certificatesExpired,
        trainingExpiringSoon,
        trainingExpired,
        supportTicketsPreview,
        supportTicketsAdminView: viewer
          ? canManageSupportTicketsAsAdmin(viewer.departman)
          : false,
        pendingManualsCount,
        pendingFormsCount,
      })
    )
  } catch (e) {
    console.error("GET /api/dashboard/summary:", e)
    return NextResponse.json(
      { error: "Could not load dashboard data" },
      { status: 500 }
    )
  }
}
