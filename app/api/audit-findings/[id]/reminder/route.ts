import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"
import { getResend, getMailFromAddress, sendHtmlEmail, escapeHtml } from "@/lib/mail"
import { getAppPublicUrl } from "@/lib/app-public-url"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string {
  if (!c) return "Bilinmeyen kullanıcı"
  return [c.isim, c.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı"
}

function formatDdMmYyyy(d: Date | null): string {
  if (!d) return "—"
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" }).format(d)
}

/**
 * POST: Bulgu için hatırlatma gönderir (Finding owner / Responsible Department, mevcut e-posta
 * altyapısı — Resend — üzerinden). Bulgu status'unu DEĞİŞTİRMEZ; birden fazla kez gönderilebilir.
 * Gönderim Finding History'ye (REMINDER_SENT) kim/ne zaman bilgisiyle kaydedilir.
 */
export async function POST(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const finding = await prisma.auditFinding.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, isim: true, soyisim: true, email: true, departman: true } },
      session: { select: { entry: { select: { auditeeDepartments: { select: { departmentName: true } } } } } },
      manualEntry: { select: { auditeeDepartments: { select: { departmentName: true } } } },
    },
  })
  if (!finding) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Alıcılar: önce doğrudan sorumlu kişi; kişi yoksa (veya e-postası yoksa) sorumlu
  // departman/grup üyelerine (finding.assignedTo.departman VEYA denetimin Auditee Group'u) gönderilir.
  let recipientLabel: string
  let recipientEmails: string[] = []

  if (finding.assignedTo?.email) {
    recipientEmails = [finding.assignedTo.email]
    recipientLabel = calisanName(finding.assignedTo)
  } else {
    const deptNames = new Set<string>()
    if (finding.assignedTo?.departman) deptNames.add(finding.assignedTo.departman)
    const entry = finding.session?.entry ?? finding.manualEntry ?? null
    for (const d of entry?.auditeeDepartments ?? []) deptNames.add(d.departmentName)

    if (deptNames.size === 0) {
      return NextResponse.json(
        { error: "Bu bulgu için ne sorumlu kişi ne de sorumlu departman/grup atanmış. Önce bir atama yapın." },
        { status: 400 }
      )
    }
    const members = await prisma.calisan.findMany({
      where: { departman: { in: Array.from(deptNames), mode: "insensitive" } },
      select: { email: true },
    })
    recipientEmails = members.map((m) => m.email).filter((e): e is string => !!e?.trim())
    recipientLabel = Array.from(deptNames).join(", ")
  }

  if (recipientEmails.length === 0) {
    return NextResponse.json(
      { error: "Hatırlatma gönderilecek e-posta adresi bulunamadı." },
      { status: 400 }
    )
  }

  const appUrl = getAppPublicUrl()
  const link = appUrl ? `${appUrl}/compliance/findings-follow-up/${id}` : `/compliance/findings-follow-up/${id}`

  const html = `
    <h2>🔔 Bulgu Hatırlatması / Finding Reminder</h2>
    <p><strong>Finding Number:</strong> ${escapeHtml(finding.findingCode)}</p>
    <p><strong>Audit Number:</strong> ${escapeHtml(finding.auditNumber ?? "—")}</p>
    <p><strong>Finding Description:</strong> ${escapeHtml(finding.explanation)}</p>
    <p><strong>Responsible:</strong> ${escapeHtml(recipientLabel)}</p>
    <p><strong>Due Date:</strong> ${escapeHtml(formatDdMmYyyy(finding.dueDate))}</p>
    <p><strong>Current Status:</strong> ${escapeHtml(finding.status)}</p>
    <hr />
    <p>Detaylara ve cevap vermeye erişmek için: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
    <small>Bon Air — Compliance Monitoring</small>
  `

  const resend = getResend()
  const result = await sendHtmlEmail(
    resend,
    recipientEmails,
    `🔔 Reminder: Finding ${finding.findingCode} — Action Required`,
    html,
    "audit-findings/reminder"
  )

  const actor = session.user?.email
    ? await prisma.calisan.findFirst({
        where: { email: { equals: session.user.email, mode: "insensitive" } },
        select: { id: true, isim: true, soyisim: true },
      })
    : null
  const actorName = calisanName(actor)

  try {
    await prisma.auditFindingHistory.create({
      data: {
        auditFindingId: id,
        actorId: actor?.id ?? null,
        eventType: "REMINDER_SENT",
        note: `Reminder sent to ${recipientLabel} by ${actorName}.`,
      },
    })
  } catch {
    // Geçmiş kaydı başarısız olsa bile gönderim sonucu döner
  }

  if ("skipped" in result) {
    return NextResponse.json({ ok: false, skipped: true, reason: result.reason, recipientLabel }, { status: 200 })
  }

  return NextResponse.json({
    ok: true,
    sent: result.sent,
    failed: result.failed,
    recipientLabel,
    recipientCount: recipientEmails.length,
    from: getMailFromAddress(),
  })
}
