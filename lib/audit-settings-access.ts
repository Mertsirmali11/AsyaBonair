import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { DEPARTMENT_PERMISSION_KEYS, hasDepartmentPermission } from "@/lib/require-department-permission"
import { prisma } from "@/lib/prisma-server"

/**
 * JWT’de `departman` bazen eksik kalır; yetki kontrolü için DB’den tamamlanır.
 */
async function resolveDepartman(
  user: { id?: string; departman?: string | null }
): Promise<string | null | undefined> {
  if (user.departman) return user.departman
  const idStr = user.id
  if (!idStr) return user.departman
  const id = Number.parseInt(idStr, 10)
  if (!Number.isFinite(id) || id < 1) return user.departman
  try {
    const row = await prisma.calisan.findUnique({
      where: { id },
      select: { departman: true },
    })
    return row?.departman ?? user.departman
  } catch {
    return user.departman
  }
}

/** Kategori listesini görebilir: Audit Plan yöneticisi (compliance_monitoring izni) veya Konfigürasyon (HR/Quality). */
export async function sessionCanReadAuditCategoryTypes() {
  const session = await auth()
  if (!session?.user) return { ok: false as const, session: null }
  const dept = await resolveDepartman(session.user)
  const mayAuditPlan = await hasDepartmentPermission(dept, DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING)
  if (mayAuditPlan || canAccessConfigurationsArea(dept)) {
    return { ok: true as const, session }
  }
  return { ok: false as const, session: null }
}

/** Kategori oluşturma / güncelleme / silme: yalnızca Konfigürasyon alanı. */
export async function sessionCanManageAuditCategoryTypes() {
  const session = await auth()
  if (!session?.user) return { ok: false as const, session: null }
  const dept = await resolveDepartman(session.user)
  if (canAccessConfigurationsArea(dept)) {
    return { ok: true as const, session }
  }
  return { ok: false as const, session: null }
}
