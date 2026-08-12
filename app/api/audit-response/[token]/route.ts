import { NextResponse } from "next/server"
import { validateActiveResponseLink, responseLinkReasonMessage } from "@/lib/audit-response-link"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ token: string }> }

/**
 * Public Audit Response Link — token ile kimliklendirilir, OTURUM GEREKMEZ.
 * Yalnızca bu tek denetime ait, cevap ekranında gösterilecek sade bilgileri döner:
 * Audit Number / Type / açıklama / planlı tarih, ve bu link'in bağlı olduğu denetime
 * daha önce auditee tarafından gönderilmiş not/dosyalar (kendi gönderim geçmişini görsün diye).
 * Checklist, finding, auditor bilgisi, diğer audit kayıtları — HİÇBİRİ döndürülmez.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params
  const validation = await validateActiveResponseLink(token)
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, reason: validation.reason, message: responseLinkReasonMessage(validation.reason) },
      { status: 404 }
    )
  }

  const entry = await prisma.auditPlanEntry.findUnique({
    where: { id: validation.link.auditPlanEntryId },
    include: {
      auditCategoryType: { select: { name: true } },
      auditSubCategoryType: { select: { name: true } },
    },
  })
  if (!entry) {
    return NextResponse.json({ ok: false, reason: "not_found", message: responseLinkReasonMessage("not_found") }, { status: 404 })
  }

  const cat = entry.auditCategoryType.name
  const sub = entry.auditSubCategoryType?.name
  const field = sub ? `${cat} — ${sub}` : cat
  const auditNumber = entry.auditNumberPrefix ? `${entry.auditNumberPrefix}-${entry.id}` : `AP-${entry.id}`

  const [notes, files] = await Promise.all([
    prisma.auditResponseNote.findMany({
      where: { auditPlanEntryId: entry.id },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        note: true,
        submitterName: true,
        submittedAt: true,
        submittedBy: { select: { isim: true, soyisim: true } },
      },
    }),
    prisma.auditPlanDocument.findMany({
      where: { auditPlanEntryId: entry.id, source: "auditee" },
      orderBy: { createdAt: "desc" },
      select: { id: true, fileName: true, fileSizeBytes: true, submitterName: true, createdAt: true },
    }),
  ])

  return NextResponse.json({
    ok: true,
    entry: {
      auditNumber,
      field,
      description: entry.remarks,
      plannedDate: entry.plannedDate.toISOString(),
    },
    notes: notes.map((n) => ({
      id: n.id,
      note: n.note,
      submitterName:
        n.submitterName ??
        ([n.submittedBy?.isim, n.submittedBy?.soyisim].filter(Boolean).join(" ").trim() || null),
      submittedAt: n.submittedAt.toISOString(),
    })),
    files: files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      fileSizeBytes: f.fileSizeBytes,
      submitterName: f.submitterName,
      createdAt: f.createdAt.toISOString(),
    })),
  })
}
