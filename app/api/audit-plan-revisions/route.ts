import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { parseDdMmYyyyToUtcDate, dbDateToDdMmYyyy } from "@/lib/correspondence-date"
import { prisma } from "@/lib/prisma-server"

/**
 * Yıllık Audit Plan'ın TAMAMININ revizyon geçmişi — audit-log/changelog, tek bir
 * AuditPlanEntry'nin revizyonu DEĞİL. Hiçbir AuditPlanEntry/AuditSession/AuditFinding satırını
 * okumaz/değiştirmez, tamamen bağımsız bir tablo çifti (AuditPlanRevision + File). Aynı
 * requireAuditPlanSession() kapısı — Audit Plan ile AYNI yetki (bkz. lib/audit-plan-session.ts).
 */
function calisanName(c: { isim: string | null; soyisim: string | null } | null): string | null {
  if (!c) return null
  const n = [c.isim, c.soyisim].filter(Boolean).join(" ").trim()
  return n || null
}

export async function GET(req: Request) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const year = Number(url.searchParams.get("year"))
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 })
  }

  const rows = await prisma.auditPlanRevision.findMany({
    where: { year },
    orderBy: { revisionNumber: "desc" },
    include: {
      createdBy: { select: { isim: true, soyisim: true } },
      attachments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fileName: true, fileSizeBytes: true, mimeType: true, createdAt: true },
      },
    },
  })

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      year: r.year,
      revisionNumber: r.revisionNumber,
      revisionDate: dbDateToDdMmYyyy(r.revisionDate),
      reason: r.reason,
      createdByName: calisanName(r.createdBy),
      createdAt: r.createdAt.toISOString(),
      attachments: r.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileSizeBytes: a.fileSizeBytes,
        mimeType: a.mimeType,
      })),
    }))
  )
}

export async function POST(req: Request) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const year = Number(b.year)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 })
  }

  const revisionDateStr = typeof b.revisionDate === "string" ? b.revisionDate : ""
  const revisionDate = parseDdMmYyyyToUtcDate(revisionDateStr)
  if (!revisionDate) {
    return NextResponse.json({ error: "Invalid revisionDate (use dd.mm.yyyy)" }, { status: 400 })
  }

  const reason = typeof b.reason === "string" ? b.reason.trim() : ""
  if (!reason) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 })
  }

  const actor = session.user?.email
    ? await prisma.calisan.findFirst({
        where: { email: { equals: session.user.email, mode: "insensitive" } },
        select: { id: true },
      })
    : null

  try {
    // Year bazında otomatik artan revizyon numarası — AuditChecklist.latestRevisionNumber ile
    // aynı sayaç deseni (MAX + 1, ilk kayıt Rev 0'dan başlar). Serializable: eşzamanlı iki
    // POST aynı numarayı hesaplarsa biri serialization_failure ile geri döner (aşağıda
    // yakalanır), veri bütünlüğü (year, revisionNumber) unique kısıtıyla da garanti altında.
    const created = await prisma.$transaction(
      async (tx) => {
        const max = await tx.auditPlanRevision.aggregate({
          where: { year },
          _max: { revisionNumber: true },
        })
        const nextNumber = (max._max.revisionNumber ?? -1) + 1
        return tx.auditPlanRevision.create({
          data: {
            year,
            revisionNumber: nextNumber,
            revisionDate,
            reason,
            createdById: actor?.id ?? null,
          },
          include: {
            createdBy: { select: { isim: true, soyisim: true } },
            attachments: true,
          },
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )

    return NextResponse.json(
      {
        id: created.id,
        year: created.year,
        revisionNumber: created.revisionNumber,
        revisionDate: dbDateToDdMmYyyy(created.revisionDate),
        reason: created.reason,
        createdByName: calisanName(created.createdBy),
        createdAt: created.createdAt.toISOString(),
        attachments: [],
      },
      { status: 201 }
    )
  } catch (e) {
    console.error("[audit-plan-revisions POST]", e)
    // P2002 (unique constraint) veya serialization_failure — eşzamanlı iki oluşturma isteği
    // çakıştı, kullanıcı tekrar denemeli (numaralandırma otomatik yeniden hesaplanır).
    return NextResponse.json(
      { error: "Revision could not be created (a concurrent revision may have just been added). Please try again." },
      { status: 409 }
    )
  }
}
