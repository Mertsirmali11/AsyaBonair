import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string }> }

/**
 * Try to read auditor_comment / auditee_comment via raw SQL.
 * Fails silently if the columns don't exist yet (before the migration is run).
 */
async function fetchComments(id: number): Promise<{ auditorComment: string | null; auditeeComment: string | null }> {
  try {
    const rows = await prisma.$queryRaw<{ auditor_comment: string | null; auditee_comment: string | null }[]>`
      SELECT auditor_comment, auditee_comment
      FROM   audit_sessions
      WHERE  id = ${id}
    `
    if (rows[0]) {
      return { auditorComment: rows[0].auditor_comment, auditeeComment: rows[0].auditee_comment }
    }
  } catch {
    // Columns not yet created — return nulls so the page still loads
  }
  return { auditorComment: null, auditeeComment: null }
}

export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const row = await prisma.auditSession.findUnique({
    where: { id },
    include: {
      checklist: {
        include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
      },
      items: true,
      findings: {
        orderBy: { createdAt: "asc" },
        include: {
          assignedTo: { select: { id: true, isim: true, soyisim: true } },
          responses: { select: { id: true, cpaStatus: true } },
        },
      },
    },
  })

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Append comment fields (raw SQL — safe even if columns don't exist yet)
  const comments = await fetchComments(id)
  return NextResponse.json({ ...row, ...comments })
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
  const status = typeof b.status === "string" ? b.status : undefined
  const auditorComment = "auditorComment" in b
    ? (typeof b.auditorComment === "string" ? b.auditorComment : null)
    : undefined
  const auditeeComment = "auditeeComment" in b
    ? (typeof b.auditeeComment === "string" ? b.auditeeComment : null)
    : undefined

  // ── Status update (Prisma — existing columns only) ───────────────────────
  const updated = await prisma.auditSession.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(status === "Completed" ? { completedAt: new Date() } : {}),
    },
  })

  // ── Comment update (raw SQL — safe even if columns don't exist yet) ──────
  if (auditorComment !== undefined || auditeeComment !== undefined) {
    try {
      if (auditorComment !== undefined && auditeeComment !== undefined) {
        await prisma.$executeRaw`
          UPDATE audit_sessions
          SET    auditor_comment = ${auditorComment},
                 auditee_comment = ${auditeeComment}
          WHERE  id = ${id}
        `
      } else if (auditorComment !== undefined) {
        await prisma.$executeRaw`
          UPDATE audit_sessions SET auditor_comment = ${auditorComment} WHERE id = ${id}
        `
      } else if (auditeeComment !== undefined) {
        await prisma.$executeRaw`
          UPDATE audit_sessions SET auditee_comment = ${auditeeComment} WHERE id = ${id}
        `
      }
    } catch {
      // Columns not yet created — comment save is a no-op until migration is run
    }
  }

  const comments = await fetchComments(id)
  return NextResponse.json({ ...updated, ...comments })
}
