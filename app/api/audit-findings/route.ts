import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { prisma } from "@/lib/prisma-server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const isAdmin = canAccessAuditPlan(session.user.email)

  // Admin değilse sadece kendine atanan bulgular
  const calisan = isAdmin
    ? null
    : await prisma.calisan.findFirst({
        where: { email: { equals: session.user.email, mode: "insensitive" } },
        select: { id: true },
      })

  if (!isAdmin && !calisan) return NextResponse.json([], { status: 200 })

  const findings = await prisma.auditFinding.findMany({
    where: isAdmin ? {} : { assignedToId: calisan!.id },
    orderBy: { createdAt: "desc" },
    include: {
      assignedTo: { select: { id: true, isim: true, soyisim: true } },
      responses: {
        orderBy: { submittedAt: "asc" },
        select: { id: true, cpaStatus: true, submittedAt: true },
      },
      extensions: {
        orderBy: { createdAt: "desc" },
        select: { id: true, newDueDate: true, status: true, isExpired: true },
      },
      session: {
        select: {
          auditPlanEntryId: true,
          entry: {
            select: {
              auditNumberPrefix: true,
              id: true,
            },
          },
        },
      },
    },
  })

  // Compute summary stats for the response
  const now = new Date()
  const mapped = findings.map((f) => {
    const totalCpa = f.responses.length
    const acceptedCpa = f.responses.filter((r) => r.cpaStatus === "Accepted").length
    const rejectedCpa = f.responses.filter((r) => r.cpaStatus === "Rejected").length
    const pendingCpa = f.responses.filter((r) => r.cpaStatus === "Pending").length
    const hasExtension = f.extensions.some((e) => e.status === "Approved")
    const extExpired = f.extensions.some((e) => e.status === "Approved" && e.isExpired)
    const isOverdue = f.status === "Open" && f.dueDate !== null && new Date(f.dueDate) < now
    const noCpa = f.status === "Open" && totalCpa === 0

    return {
      id: f.id,
      findingCode: f.findingCode,
      auditNumber: f.auditNumber,
      initializedOn: f.initializedOn.toISOString(),
      field: f.field,
      explanation: f.explanation,
      reference: f.reference,
      dueDate: f.dueDate?.toISOString() ?? null,
      status: f.status,
      assignedTo: f.assignedTo
        ? { id: f.assignedTo.id, name: [f.assignedTo.isim, f.assignedTo.soyisim].filter(Boolean).join(" ") }
        : null,
      cpaRequests: `${totalCpa}/${acceptedCpa}/${rejectedCpa}`,
      pendingCpa,
      hasExtension,
      extExpired,
      isOverdue,
      noCpa,
    }
  })

  return NextResponse.json(mapped)
}
