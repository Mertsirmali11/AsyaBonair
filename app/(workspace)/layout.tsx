import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import {
  getResolvedDepartmentPermissionsForUser,
  type ResolvedDepartmentPermissions,
} from "@/lib/department-permissions-resolve"

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }

  const user = {
    name: session.user?.name || "User",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  // Show Audit Plan nav: Compliance Monitoring department permission (source of truth:
  // Configurations → Yetkilendirme matrisi). Bu sorgu HER sayfa yüklemesinde koşulsuz
  // çalışıyor — kendi içinde zaten savunmacı hale getirildi (bkz.
  // lib/department-permissions-resolve.ts), ama burada da ikinci bir güvenlik ağı: hiçbir
  // durumda bu satır tüm uygulama kabuğunu (sidebar dahil) çökertmemeli. Geçici bir hata
  // olursa "izin yok" varsayımıyla devam edilir.
  let permissions: ResolvedDepartmentPermissions = {}
  try {
    permissions = await getResolvedDepartmentPermissionsForUser(session.user?.departman)
  } catch (e) {
    console.error("[WorkspaceLayout] department permissions resolve failed:", e)
  }
  const showAuditPlanNav = !!permissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING]

  return (
    <DashboardLayout
      user={user}
      showAuditPlanNav={showAuditPlanNav}
      departmentPermissions={permissions}
    >
      {children}
    </DashboardLayout>
  )
}
