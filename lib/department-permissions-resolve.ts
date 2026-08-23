import "server-only"

import { normalizeDepartmentKey } from "@/lib/department-access"
import {
  DEPARTMENT_PERMISSION_CATALOG,
  orderedDepartmentPermissionKeys,
} from "@/lib/department-permission-keys"
import { legacyDepartmentPermission } from "@/lib/department-permissions-legacy"
import {
  resolveDepartmentPermissionsFromRows,
  type ResolvedDepartmentPermissions,
} from "@/lib/department-permissions-precedence"
import { prisma } from "@/lib/prisma-server"

export type { ResolvedDepartmentPermissions }

function isMissingTableError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false
  const code = "code" in e ? (e as { code?: unknown }).code : undefined
  return code === "P2021"
}

export async function getResolvedDepartmentPermissionsForUser(
  departman: string | null | undefined
): Promise<ResolvedDepartmentPermissions> {
  const nk = normalizeDepartmentKey(departman)
  const keys = orderedDepartmentPermissionKeys()
  if (!nk) {
    return resolveDepartmentPermissionsFromRows([], departman)
  }
  let rows: { permissionKey: string; allowed: boolean }[] = []
  try {
    rows = await prisma.departmentPermission.findMany({
      where: { departmentKey: nk, permissionKey: { in: [...keys] } },
      select: { permissionKey: true, allowed: true },
    })
  } catch (e) {
    if (!isMissingTableError(e)) {
      // Bu fonksiyon (workspace)/layout.tsx tarafından HER sayfa yüklemesinde,
      // koşulsuz olarak çağrılıyor. Geçici bir DB bağlantı sorunu (connection
      // pool doluluğu, timeout vb. — ör. P2024) burada yakalanmazsa tüm
      // uygulama kabuğu (sidebar dahil) Next.js'in generic "Application
      // error" sayfasına düşer — hiçbir error.tsx bunu önleyemez, çünkü hata
      // layout.tsx'in KENDİSİNDEN geliyor. Geçici bir hata durumunda "izin
      // yok" varsayımıyla devam etmek (bir sonraki sayfa yüklemesinde normale
      // döner), tüm uygulamayı çökertmekten kesinlikle daha güvenli.
      console.error("[getResolvedDepartmentPermissionsForUser] DB error, izinler boş dönüyor:", e)
      rows = []
    } else {
      rows = []
    }
  }
  return resolveDepartmentPermissionsFromRows(rows, departman)
}

export async function getAdminDepartmentPermissionsMatrix(): Promise<{
  catalog: typeof DEPARTMENT_PERMISSION_CATALOG
  rows: {
    departmentKey: string
    displayName: string
    cells: {
      permissionKey: string
      mode: "inherit" | "allow" | "deny"
      effective: boolean
    }[]
  }[]
}> {
  const catalog = DEPARTMENT_PERMISSION_CATALOG
  const custom = await prisma.customDepartment.findMany({
    orderBy: { name: "asc" },
    select: { name: true },
  })
  let distinctDeptKeys: { departmentKey: string }[] = []
  try {
    distinctDeptKeys = await prisma.departmentPermission.findMany({
      select: { departmentKey: true },
      distinct: ["departmentKey"],
    })
  } catch (e) {
    if (!isMissingTableError(e)) throw e
    distinctDeptKeys = []
  }
  const keyToLabel = new Map<string, string>()
  for (const c of custom) {
    const nk = normalizeDepartmentKey(c.name)
    if (!nk) continue
    if (!keyToLabel.has(nk)) keyToLabel.set(nk, c.name)
  }
  for (const d of distinctDeptKeys) {
    if (!keyToLabel.has(d.departmentKey)) {
      keyToLabel.set(d.departmentKey, d.departmentKey)
    }
  }
  const sortedKeys = [...keyToLabel.entries()].sort((a, b) =>
    a[1].localeCompare(b[1], "tr", { sensitivity: "base" })
  )
  let stored: { departmentKey: string; permissionKey: string; allowed: boolean }[] = []
  try {
    stored = await prisma.departmentPermission.findMany({
      select: { departmentKey: true, permissionKey: true, allowed: true },
    })
  } catch (e) {
    if (!isMissingTableError(e)) throw e
    stored = []
  }
  const lookup = new Map<string, Map<string, boolean>>()
  for (const r of stored) {
    if (!lookup.has(r.departmentKey)) lookup.set(r.departmentKey, new Map())
    lookup.get(r.departmentKey)!.set(r.permissionKey, r.allowed)
  }
  return {
    catalog,
    rows: sortedKeys.map(([departmentKey, displayName]) => ({
      departmentKey,
      displayName,
      cells: catalog.map((entry) => {
        const override = lookup.get(departmentKey)?.get(entry.key)
        const mode: "inherit" | "allow" | "deny" =
          override === undefined ? "inherit" : override ? "allow" : "deny"
        const effective =
          override === undefined
            ? legacyDepartmentPermission(entry.key, displayName)
            : override
        return {
          permissionKey: entry.key,
          mode,
          effective,
        }
      }),
    })),
  }
}
