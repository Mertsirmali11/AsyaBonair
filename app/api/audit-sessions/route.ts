import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

export async function POST(req: Request) {
  const session = await requireAuditPlanSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const b = body as Record<string, unknown>
  const auditPlanEntryId = Number(b.auditPlanEntryId)
  const auditChecklistId = Number(b.auditChecklistId)

  if (!Number.isInteger(auditPlanEntryId) || auditPlanEntryId < 1)
    return NextResponse.json({ error: "Invalid auditPlanEntryId" }, { status: 400 })
  if (!Number.isInteger(auditChecklistId) || auditChecklistId < 1)
    return NextResponse.json({ error: "Invalid auditChecklistId" }, { status: 400 })

  // Verify entry exists
  const entry = await prisma.auditPlanEntry.findUnique({ where: { id: auditPlanEntryId } })
  if (!entry) return NextResponse.json({ error: "Audit plan entry not found" }, { status: 404 })

  // Verify checklist is assigned
  const assignment = await prisma.auditPlanChecklistAssignment.findFirst({
    where: { auditPlanEntryId, auditChecklistId },
  })
  if (!assignment) return NextResponse.json({ error: "Checklist not assigned to this audit" }, { status: 400 })

  // Check if session already exists
  const existing = await prisma.auditSession.findFirst({
    where: { auditPlanEntryId, auditChecklistId },
    include: {
      checklist: { include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } },
      items: {
        include: {
          finding: { select: { id: true, findingCode: true, findingLevel: true, status: true } },
          attachments: true,
        },
      },
    },
  })
  if (existing) return NextResponse.json(existing)

  const created = await prisma.auditSession.create({
    data: { auditPlanEntryId, auditChecklistId, status: "InProgress" },
    include: {
      checklist: { include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } },
      items: {
        include: {
          finding: { select: { id: true, findingCode: true, findingLevel: true, status: true } },
          attachments: true,
        },
      },
    },
  })

  return NextResponse.json(created, { status: 201 })
}
