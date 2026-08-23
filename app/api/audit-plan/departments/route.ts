import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET: Auditee Group/Department seçimi için kayıtlı departman adları (Configurations → Departmanlar). */
export async function GET() {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const rows = await prisma.customDepartment.findMany({
    orderBy: { name: "asc" },
    select: { name: true },
  })
  return NextResponse.json(rows.map((r) => r.name))
}
