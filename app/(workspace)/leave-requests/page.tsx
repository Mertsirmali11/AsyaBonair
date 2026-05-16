import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { LeaveRequestsClient } from "./leave-requests-client"
import { prisma } from "@/lib/prisma-server"
import { getLeaveAccessContext } from "@/lib/leave-access"

export default async function LeaveRequestsPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const ctx = await getLeaveAccessContext(session.user.email)
  if (!ctx) redirect("/dashboard")

  // Server-side initial data fetch
  type WhereClause = Parameters<typeof prisma.leaveRequest.findMany>[0]["where"]
  let where: WhereClause = {}

  if (ctx.isGlobalAdmin) {
    // Admin tümünü görür
  } else if (ctx.isManager) {
    where = { employee: { departman: { equals: ctx.departman ?? "", mode: "insensitive" } } }
  } else {
    where = { employeeId: ctx.calisanId }
  }

  const [requests, titles] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        subcategory: true,
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
          select: { id: true, isim: true, soyisim: true },
        },
      },
    }),
    ctx.isManager || ctx.isGlobalAdmin
      ? prisma.departmentTitle.findMany({
          where: ctx.isGlobalAdmin
            ? undefined
            : { departmentName: { equals: ctx.departman ?? "", mode: "insensitive" } },
          select: { id: true, titleName: true, departmentName: true, isManager: true },
          orderBy: [{ departmentName: "asc" }, { titleName: "asc" }],
        })
      : Promise.resolve([]),
  ])

  const serialized = {
    requests: requests.map((r) => ({
      ...r,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    titles,
    ctx: {
      calisanId: ctx.calisanId,
      departman: ctx.departman,
      isManager: ctx.isManager,
      isGlobalAdmin: ctx.isGlobalAdmin,
    },
  }

  return (
    <>
      <SetWorkspacePageTitle title="Leave Requests" />
      <LeaveRequestsClient data={serialized} />
    </>
  )
}
