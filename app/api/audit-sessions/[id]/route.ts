import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

const GENERIC_COMPLETE_ERROR =
  "Audit could not be completed. Please try again or contact the system administrator."

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

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string {
  if (!c) return "Bilinmeyen kullanıcı"
  const n = [c.isim, c.soyisim].filter(Boolean).join(" ").trim()
  return n || "Bilinmeyen kullanıcı"
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
      entry: { select: { status: true, cancellationReason: true } },
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

  try {
    const existingSession = await prisma.auditSession.findUnique({
      where: { id },
      select: { id: true, status: true, auditPlanEntryId: true },
    })
    if (!existingSession) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // ── Status update (Prisma — existing columns only) ───────────────────────
    const updated = await prisma.auditSession.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(status === "Completed" ? { completedAt: new Date() } : {}),
      },
    })

    // Checklist oturumu "Completed" olduğunda, bağlı olduğu denetim kaydı (Audit Plan
    // Entry) da otomatik olarak Completed'a taşınır — "Manage Audit → Assigned Checklist
    // → Complete Audit" akışının kullanıcı beklediği tek bir "denetimi tamamla" eylemi
    // olarak çalışması için. Zaten Cancelled veya Completed olan bir kaydın üzerine
    // sessizce yazılmaz (iptal edilmiş bir denetim bu yolla geri açılmaz).
    let entryCompleted = false
    if (status === "Completed" && existingSession.status !== "Completed") {
      try {
        const entry = await prisma.auditPlanEntry.findUnique({
          where: { id: existingSession.auditPlanEntryId },
          select: { status: true },
        })
        if (entry && entry.status !== "Cancelled" && entry.status !== "Completed") {
          const actorEmail = session.user?.email
          const actor = actorEmail
            ? await prisma.calisan.findFirst({
                where: { email: { equals: actorEmail, mode: "insensitive" } },
                select: { id: true, isim: true, soyisim: true },
              })
            : null
          await prisma.$transaction([
            prisma.auditPlanEntry.update({
              where: { id: existingSession.auditPlanEntryId },
              data: { status: "Completed" },
            }),
            prisma.auditPlanEntryHistory.create({
              data: {
                auditPlanEntryId: existingSession.auditPlanEntryId,
                actorId: actor?.id ?? null,
                eventType: "STATUS_CHANGED",
                statusFrom: entry.status,
                statusTo: "Completed",
                note: `Denetim, checklist tamamlanmasıyla birlikte ${calisanName(actor)} tarafından Completed olarak işaretlendi.`,
              },
            }),
          ])
          entryCompleted = true
        }
      } catch (entryErr) {
        // Ana checklist tamamlama işlemini asla etkilemesin — sadece logla.
        console.error("[audit-sessions PATCH] entry auto-complete failed", entryErr)
      }
    }

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
    return NextResponse.json({
      ...updated,
      ...comments,
      auditPlanEntryId: existingSession.auditPlanEntryId,
      entryCompleted,
    })
  } catch (e) {
    console.error("[audit-sessions PATCH] unexpected error", { sessionId: id, status }, e)
    return NextResponse.json({ error: GENERIC_COMPLETE_ERROR }, { status: 500 })
  }
}
