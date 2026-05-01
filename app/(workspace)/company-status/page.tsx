import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { CompanyStatusClient } from "./company-status-client"
import { prisma } from "@/lib/prisma-server"
import { prismaJson } from "@/lib/prisma-json"

export default async function CompanyStatusPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const today = new Date()
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))

  const [employees, activeLeaves] = await Promise.all([
    prisma.calisan.findMany({
      where: { istenCikisTarihi: null },  // Aktif çalışanlar
      select: {
        id: true,
        isim: true,
        soyisim: true,
        departman: true,
        workLocation: true,
        title: { select: { titleName: true, isManager: true } },
      },
      orderBy: [{ departman: "asc" }, { isim: "asc" }],
    }),
    // Bugün aktif onaylı izinler
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: todayUTC },
        endDate: { gte: todayUTC },
      },
      select: { employeeId: true, startDate: true, endDate: true },
    }),
  ])

  const onLeaveIds = new Set(activeLeaves.map((l) => l.employeeId))

  const statusBoard = employees.map((emp) => ({
    id: emp.id,
    isim: emp.isim,
    soyisim: emp.soyisim,
    departman: emp.departman,
    titleName: emp.title?.titleName ?? null,
    isManager: emp.title?.isManager ?? false,
    workLocation: emp.workLocation ?? "Office",
    isOnLeave: onLeaveIds.has(emp.id),
  }))

  return (
    <>
      <SetWorkspacePageTitle title="Company Status Board" />
      <CompanyStatusClient data={prismaJson(statusBoard) as typeof statusBoard} />
    </>
  )
}
