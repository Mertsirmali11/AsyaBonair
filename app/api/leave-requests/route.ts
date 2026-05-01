import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import {
  getLeaveAccessContext,
  findDepartmentApprover,
} from "@/lib/leave-access"

// ─── Shared select ────────────────────────────────────────────────────────────

const leaveSelect = {
  id: true,
  startDate: true,
  endDate: true,
  reason: true,
  status: true,
  reviewNote: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      isim: true,
      soyisim: true,
      departman: true,
      title: { select: { titleName: true, isManager: true } },
    },
  },
  approver: {
    select: {
      id: true,
      isim: true,
      soyisim: true,
      departman: true,
    },
  },
} as const

// ─── GET /api/leave-requests ──────────────────────────────────────────────────
/**
 * Departman izolasyonu:
 * - Normal çalışan: yalnızca kendi talepleri.
 * - Yönetici: yalnızca kendi departmanının talepleri.
 * - Global Admin: tüm talepler.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const ctx = await getLeaveAccessContext(session.user.email)
    if (!ctx) {
      return NextResponse.json({ error: "Çalışan kaydı bulunamadı." }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get("status") // PENDING | APPROVED | REJECTED
    const limitParam = parseInt(searchParams.get("limit") ?? "100")
    const limit = isNaN(limitParam) ? 100 : Math.min(limitParam, 500)

    // Departman izolasyonu
    type WhereClause = Parameters<typeof prisma.leaveRequest.findMany>[0]["where"]
    let where: WhereClause = {}

    if (ctx.isGlobalAdmin) {
      // Admin: tümünü görür, isteğe bağlı dept filtresi
      const deptFilter = searchParams.get("department")
      if (deptFilter) {
        where = { employee: { departman: { equals: deptFilter, mode: "insensitive" } } }
      }
    } else if (ctx.isManager) {
      // Yönetici: yalnızca kendi departmanı — KESİN KURAL
      if (!ctx.departman) {
        return NextResponse.json({ error: "Departman bilgisi eksik." }, { status: 403 })
      }
      where = {
        employee: { departman: { equals: ctx.departman, mode: "insensitive" } },
      }
    } else {
      // Normal çalışan: yalnızca kendi talepleri
      where = { employeeId: ctx.calisanId }
    }

    if (statusFilter && ["PENDING", "APPROVED", "REJECTED"].includes(statusFilter)) {
      where = { ...where, status: statusFilter as "PENDING" | "APPROVED" | "REJECTED" }
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      select: leaveSelect,
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return NextResponse.json({
      requests,
      meta: {
        isManager: ctx.isManager,
        isGlobalAdmin: ctx.isGlobalAdmin,
        departman: ctx.departman,
      },
    })
  } catch (e) {
    console.error("[GET /api/leave-requests]", e)
    return NextResponse.json({ error: "İzin talepleri yüklenemedi." }, { status: 500 })
  }
}

// ─── POST /api/leave-requests ─────────────────────────────────────────────────
/**
 * Yeni izin talebi oluşturur.
 * Onaylayıcı: aynı departmandaki ilk yönetici otomatik atanır.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const ctx = await getLeaveAccessContext(session.user.email)
    if (!ctx) {
      return NextResponse.json({ error: "Çalışan kaydı bulunamadı." }, { status: 403 })
    }

    const body = (await req.json()) as {
      startDate?: string
      endDate?: string
      reason?: string
    }

    if (!body.startDate || !body.endDate) {
      return NextResponse.json({ error: "startDate ve endDate zorunlu." }, { status: 400 })
    }

    const start = new Date(body.startDate)
    const end = new Date(body.endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Geçersiz tarih formatı." }, { status: 400 })
    }
    if (end < start) {
      return NextResponse.json({ error: "Bitiş tarihi başlangıçtan önce olamaz." }, { status: 400 })
    }

    // Onaylayıcıyı otomatik ata — kendi departmanındaki yönetici
    const approverId = await findDepartmentApprover(ctx.departman, ctx.calisanId)

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: ctx.calisanId,
        approverId,
        startDate: start,
        endDate: end,
        reason: body.reason?.trim() ?? null,
        status: "PENDING",
      },
      select: leaveSelect,
    })

    return NextResponse.json({ leaveRequest }, { status: 201 })
  } catch (e) {
    console.error("[POST /api/leave-requests]", e)
    return NextResponse.json({ error: "İzin talebi oluşturulamadı." }, { status: 500 })
  }
}
