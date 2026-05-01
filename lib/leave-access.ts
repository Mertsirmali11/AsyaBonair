import "server-only"

/**
 * İzin sistemi erişim kontrolü — departman izolasyonu.
 *
 * TEMEL KURAL: Bir yönetici yalnızca kendi departmanındaki çalışanların
 * izin taleplerini görebilir ve onaylayabilir / reddedebilir.
 */

import { prisma } from "@/lib/prisma-server"
import { isAdminDepartment } from "@/lib/department-access"

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

/** Departman adını normalize eder (büyük/küçük harf bağımsız karşılaştırma). */
function normDept(d: string | null | undefined): string {
  return (d ?? "").trim().toLowerCase()
}

/**
 * Çalışanın unvanı yönetici mi?
 * title.isManager=true VEYA Admin departmanındaki herkes yönetici sayılır.
 */
export function isTitleManager(
  isManager: boolean,
  departman: string | null | undefined
): boolean {
  return isManager || isAdminDepartment(departman)
}

// ─── Mevcut kullanıcı context'i ──────────────────────────────────────────────

export type LeaveAccessContext = {
  calisanId: number
  departman: string | null
  isManager: boolean
  /** Admin departmanı — tüm departmanları görebilir */
  isGlobalAdmin: boolean
}

/**
 * Oturum email'inden LeaveAccessContext oluşturur.
 * Çalışan bulunamazsa null döner (erişim yok).
 */
export async function getLeaveAccessContext(
  email: string
): Promise<LeaveAccessContext | null> {
  const calisan = await prisma.calisan.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      departman: true,
      title: { select: { isManager: true } },
    },
  })
  if (!calisan) return null

  const isGlobalAdmin = isAdminDepartment(calisan.departman)
  const isManager = isGlobalAdmin || (calisan.title?.isManager ?? false)

  return {
    calisanId: calisan.id,
    departman: calisan.departman ?? null,
    isManager,
    isGlobalAdmin,
  }
}

// ─── Erişim kontrol işlemleri ─────────────────────────────────────────────────

/**
 * Hedef çalışanın departmanını kontrol ederek erişim iznini doğrular.
 * Yöneticiler yalnızca kendi departmanlarını yönetebilir (Admin hariç).
 */
export function canManageDepartment(
  ctx: LeaveAccessContext,
  targetDepartman: string | null | undefined
): boolean {
  if (ctx.isGlobalAdmin) return true
  if (!ctx.isManager) return false
  return normDept(ctx.departman) === normDept(targetDepartman)
}

/**
 * Bir izin talebinin detayını görüntüleme yetkisi.
 * - Talebi oluşturan çalışan her zaman görebilir.
 * - Yönetici yalnızca kendi departmanındaki talepleri görebilir.
 */
export function canViewLeaveRequest(
  ctx: LeaveAccessContext,
  employeeId: number,
  employeeDepartman: string | null | undefined
): boolean {
  if (ctx.calisanId === employeeId) return true
  return canManageDepartment(ctx, employeeDepartman)
}

// ─── Onaylayıcı otomatik atama ────────────────────────────────────────────────

/**
 * Aynı departmandaki ilk yönetici çalışanı bulur.
 * Bulunamazsa null döner (talep yine de oluşturulur, approver atanamaz).
 */
export async function findDepartmentApprover(
  departman: string | null | undefined,
  excludeEmployeeId?: number
): Promise<number | null> {
  if (!departman) return null

  const manager = await prisma.calisan.findFirst({
    where: {
      departman: { equals: departman, mode: "insensitive" },
      title: { isManager: true },
      ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
      istenCikisTarihi: null, // işten çıkmış değil
    },
    select: { id: true },
    orderBy: { id: "asc" },
  })

  return manager?.id ?? null
}

// ─── Bugün izinli mi? ─────────────────────────────────────────────────────────

/** Belirtilen tarih için onaylı izin talebi var mı? */
export async function isOnLeaveToday(
  employeeId: number,
  date: Date = new Date()
): Promise<boolean> {
  const today = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
  const req = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,
      status: "APPROVED",
      startDate: { lte: today },
      endDate: { gte: today },
    },
    select: { id: true },
  })
  return !!req
}
