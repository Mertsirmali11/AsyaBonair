import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET: Auditee Group/Department seçimi için kayıtlı departman adları (Configurations → Departmanlar). */
export async function GET() {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const rows = await prisma.customDepartment.findMany({
    orderBy: { name: "asc" },
    select: { name: true },
  })
  return NextResponse.json(rows.map((r) => r.name))
}
