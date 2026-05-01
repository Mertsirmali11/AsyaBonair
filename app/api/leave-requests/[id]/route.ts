import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import {
  getLeaveAccessContext,
  canViewLeaveRequest,
  canManageDepartment,
} from "@/lib/leave-access"

// ─── GET /api/leave-requests/[id] ────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const leaveId = parseInt(id)
    if (isNaN(leaveId)) {
      return NextResponse.json({ error: "Geçersiz id." }, { status: 400 })
    }

    const ctx = await getLeaveAccessContext(session.user.email)
    if (!ctx) {
      return NextResponse.json({ error: "Çalışan kaydı bulunamadı." }, { status: 403 })
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: {
        employee: {
          select: {
            id: true, isim: true, soyisim: true, departman: true,
            title: { select: { titleName: true, isManager: true } },
          },
        },
        approver: {
          select: { id: true, isim: true, soyisim: true, departman: true },
        },
      },
    })

    if (!leave) {
      return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 })
    }

    // Departman izolasyonu
    if (!canViewLeaveRequest(ctx, leave.employeeId, leave.employee.departman)) {
      return NextResponse.json(
        { error: "PermissionDenied: Bu departmanın taleplerini görüntüleme yetkiniz yok." },
        { status: 403 }
      )
    }

    return NextResponse.json({ leave })
  } catch (e) {
    console.error("[GET /api/leave-requests/:id]", e)
    return NextResponse.json({ error: "Talep yüklenemedi." }, { status: 500 })
  }
}

// ─── PATCH /api/leave-requests/[id] ──────────────────────────────────────────
/**
 * Onaylama / reddetme — yalnızca yönetici ve yalnızca kendi departmanı.
 * Çalışan kendi talebini iptal edebilir (status: PENDING → REJECTED kendi tarafından).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const leaveId = parseInt(id)
    if (isNaN(leaveId)) {
      return NextResponse.json({ error: "Geçersiz id." }, { status: 400 })
    }

    const ctx = await getLeaveAccessContext(session.user.email)
    if (!ctx) {
      return NextResponse.json({ error: "Çalışan kaydı bulunamadı." }, { status: 403 })
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: {
        employee: { select: { id: true, departman: true } },
      },
    })

    if (!leave) {
      return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 })
    }

    const body = (await req.json()) as {
      status?: string
      reviewNote?: string
    }

    const newStatus = body.status as "APPROVED" | "REJECTED" | undefined
    if (!newStatus || !["APPROVED", "REJECTED"].includes(newStatus)) {
      return NextResponse.json(
        { error: "status: APPROVED veya REJECTED olmalı." },
        { status: 400 }
      )
    }

    // Kendi talebi — sadece iptal (REJECTED) yapabilir, approve edemez
    const isSelf = ctx.calisanId === leave.employeeId
    if (isSelf) {
      if (newStatus === "APPROVED") {
        return NextResponse.json(
          { error: "Kendi izin talebinizi onaylayamazsınız." },
          { status: 403 }
        )
      }
      if (leave.status !== "PENDING") {
        return NextResponse.json(
          { error: "Yalnızca Beklemede (PENDING) durumdaki talepler iptal edilebilir." },
          { status: 409 }
        )
      }
    } else {
      // Yönetici akışı — departman izolasyonu kontrolü
      if (!ctx.isManager) {
        return NextResponse.json(
          { error: "PermissionDenied: Yönetici yetkisi gerekli." },
          { status: 403 }
        )
      }
      if (!canManageDepartment(ctx, leave.employee.departman)) {
        return NextResponse.json(
          {
            error:
              "PermissionDenied: Bu departmanın izin taleplerini yönetme yetkiniz yok.",
          },
          { status: 403 }
        )
      }
      if (leave.status !== "PENDING") {
        return NextResponse.json(
          { error: "Yalnızca Beklemede (PENDING) durumdaki talepler işlenebilir." },
          { status: 409 }
        )
      }
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: newStatus,
        reviewNote: body.reviewNote?.trim() ?? null,
      },
      include: {
        employee: {
          select: {
            id: true, isim: true, soyisim: true, departman: true,
            title: { select: { titleName: true, isManager: true } },
          },
        },
        approver: {
          select: { id: true, isim: true, soyisim: true, departman: true },
        },
      },
    })

    return NextResponse.json({ leave: updated })
  } catch (e) {
    console.error("[PATCH /api/leave-requests/:id]", e)
    return NextResponse.json({ error: "Talep güncellenemedi." }, { status: 500 })
  }
}
