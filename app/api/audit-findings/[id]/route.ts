import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const entryInclude = {
    auditCategoryType: { select: { name: true } },
    auditSubCategoryType: { select: { name: true } },
    auditees: {
      select: {
        calisan: { select: { id: true, isim: true, soyisim: true } },
      },
    },
  } as const

  const finding = await prisma.auditFinding.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, isim: true, soyisim: true, departman: true } },
      responses: {
        orderBy: { submittedAt: "asc" },
        include: {
          respondedBy: { select: { id: true, isim: true, soyisim: true } },
          attachments: true,
        },
      },
      extensions: {
        orderBy: { createdAt: "desc" },
        include: {
          requestedBy: { select: { id: true, isim: true, soyisim: true } },
        },
      },
      session: {
        include: {
          entry: { include: entryInclude },
          checklist: { select: { id: true, title: true, checklistNumber: true } },
        },
      },
      // Denetim Planı panelinden manuel eklenen bulgularda session yerine doğrudan entry bağlıdır
      manualEntry: { include: entryInclude },
      sessionItem: {
        include: { checklistItem: true },
      },
    },
  })

  if (!finding) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { manualEntry, session: findingSession, ...rest } = finding

  // Checklist tabanlı ve manuel bulguları istemci için tek biçimde döndür — manuel
  // bulgularda gerçek AuditSession/checklist yoktur, ancak "entry" (kategori/denetlenenler)
  // bilgisi aynı şekle sokularak finding-detail-client.tsx hiç değişmeden çalışabilir.
  const normalizedSession = findingSession
    ? findingSession
    : manualEntry
      ? { entry: manualEntry, checklist: null }
      : null

  return NextResponse.json({ ...rest, session: normalizedSession })
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const b = body as Record<string, unknown>

  const data: Record<string, unknown> = {}
  if (typeof b.status === "string") data.status = b.status
  if (typeof b.explanation === "string") data.explanation = b.explanation.trim()
  if (typeof b.reference === "string") data.reference = b.reference.trim() || null
  if (typeof b.dueDate === "string") data.dueDate = b.dueDate ? new Date(b.dueDate) : null
  if (b.assignedToId !== undefined) {
    data.assignedToId = b.assignedToId ? Number(b.assignedToId) : null
  }

  const updated = await prisma.auditFinding.update({ where: { id }, data })
  return NextResponse.json(updated)
}
