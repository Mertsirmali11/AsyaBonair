import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { assertCanManageAnnouncements } from "@/lib/announcements-access"
import { getAppPublicUrl } from "@/lib/app-public-url"
import { Resend } from "resend"

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return null
  return new Resend(key)
}

function getFromAddress(): string {
  const from = process.env.RESEND_FROM?.trim()
  if (from) return from
  return "Bonair <onboarding@resend.dev>"
}

/**
 * Quality/HR: Okuma/onay raporunu kendi e-postasına gönderir (okumayan listesi dahil).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertCanManageAnnouncements()
  if (!gate.ok) return gate.response

  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const announcementId = Number.parseInt(id, 10)
  if (Number.isNaN(announcementId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const resend = getResend()
  if (!resend) {
    return NextResponse.json(
      { error: "RESEND_API_KEY yapılandırılmadığı için e-posta gönderilemedi." },
      { status: 503 }
    )
  }

  const ann = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true, title: true, createdAt: true },
  })
  if (!ann) {
    return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
  }

  const totalStaff = await prisma.calisan.count()
  const ackRows = await prisma.announcementAcknowledgment.findMany({
    where: { announcementId },
    include: {
      calisan: {
        select: { isim: true, soyisim: true, departman: true, email: true },
      },
    },
    orderBy: { acknowledgedAt: "desc" },
  })
  const ackedIds = new Set(ackRows.map((r) => r.calisanId))
  const allCalisan = await prisma.calisan.findMany({
    select: { id: true, isim: true, soyisim: true, departman: true, email: true },
    orderBy: [{ soyisim: "asc" }, { isim: "asc" }],
  })
  const notAck = allCalisan.filter((c) => !ackedIds.has(c.id))

  const portal = getAppPublicUrl()
  const portalLine = portal
    ? `<p>Portal: <a href="${escapeHtml(`${portal}/dashboard`)}">${escapeHtml(`${portal}/dashboard`)}</a></p>`
    : ""

  const rowsPending = notAck
    .map(
      (c) =>
        `<tr><td>${escapeHtml(`${c.isim ?? ""} ${c.soyisim ?? ""}`.trim())}</td><td>${escapeHtml(c.departman ?? "—")}</td><td>${escapeHtml(c.email)}</td></tr>`
    )
    .join("")

  const rowsOk = ackRows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(`${r.calisan.isim ?? ""} ${r.calisan.soyisim ?? ""}`.trim())}</td><td>${escapeHtml(r.calisan.departman ?? "—")}</td><td>${escapeHtml(r.acknowledgedAt.toISOString())}</td></tr>`
    )
    .join("")

  const html = `
    <h1>Duyuru onay raporu</h1>
    <p><strong>${escapeHtml(ann.title)}</strong> (ID: ${ann.id})</p>
    <p>Toplam çalışan: ${totalStaff} · Onaylayan: ${ackRows.length} · Henüz onaylamayan: ${notAck.length}</p>
    ${portalLine}
    <h2>Henüz «Okudum, anladım» demeyenler</h2>
    <table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Ad Soyad</th><th>Departman</th><th>E-posta</th></tr></thead><tbody>${rowsPending || "<tr><td colspan=\"3\">Yok</td></tr>"}</tbody></table>
    <h2>Onaylayanlar</h2>
    <table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Ad Soyad</th><th>Departman</th><th>Onay zamanı (UTC)</th></tr></thead><tbody>${rowsOk || "<tr><td colspan=\"3\">Yok</td></tr>"}</tbody></table>
  `

  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to: [session.user.email],
    subject: `[Bonair] Duyuru onay raporu: ${ann.title.slice(0, 80)}`,
    html,
  })

  if (error) {
    console.error("[email-ack-report]", error)
    return NextResponse.json({ error: error.message }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
