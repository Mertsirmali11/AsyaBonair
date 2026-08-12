import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { getResend, sendHtmlEmail, escapeHtml } from "@/lib/mail"
import { getAppPublicUrl } from "@/lib/app-public-url"

export const runtime = "nodejs"
export const maxDuration = 120

type Bucket = "overdue" | "today" | "soon"

type DigestItem = {
  planId: number
  planName: string
  title: string
  dueDate: Date
  priority: string
  taskId: number
}

/**
 * Günlük Planner hatırlatma e-postası — Bonjour'da kalıcı bir in-app bildirim/bell
 * sistemi olmadığı için (mevcut tek altyapı: manuel "Send Reminder" e-postaları ve
 * bu projedeki tek örnek olan /api/cron/shgm-mevzuat), aynı desen kullanılır:
 * Overdue / Due Today / Due Soon (≤3 gün) task'ları olan her kullanıcıya (bireysel
 * atanmış VEYA atanmış departmanın üyesi olarak) tek bir özet e-posta gönderilir.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const soonCutoff = new Date(today)
    soonCutoff.setDate(soonCutoff.getDate() + 3)

    const tasks = await prisma.plannerTask.findMany({
      where: {
        deletedAt: null,
        status: { not: "Completed" },
        dueDate: { not: null, lte: soonCutoff },
      },
      include: {
        plan: { select: { id: true, name: true } },
        assignees: { include: { calisan: { select: { email: true } } } },
        departments: true,
      },
    })

    if (tasks.length === 0) {
      return NextResponse.json({ recipients: 0, tasks: 0 })
    }

    const deptNames = [...new Set(tasks.flatMap((t) => t.departments.map((d) => d.departmentName)))]
    const deptMembers = deptNames.length
      ? await prisma.calisan.findMany({
          where: { departman: { in: deptNames }, istenCikisTarihi: null },
          select: { email: true, departman: true },
        })
      : []
    const membersByDept = new Map<string, string[]>()
    for (const m of deptMembers) {
      if (!m.departman || !m.email) continue
      const arr = membersByDept.get(m.departman) ?? []
      arr.push(m.email)
      membersByDept.set(m.departman, arr)
    }

    const byRecipient = new Map<string, Record<Bucket, DigestItem[]>>()
    const addItem = (email: string, bucket: Bucket, item: DigestItem) => {
      const rec = byRecipient.get(email) ?? { overdue: [], today: [], soon: [] }
      rec[bucket].push(item)
      byRecipient.set(email, rec)
    }

    for (const t of tasks) {
      if (!t.dueDate) continue
      const due = new Date(t.dueDate)
      due.setHours(0, 0, 0, 0)
      const bucket: Bucket = due.getTime() < today.getTime() ? "overdue" : due.getTime() === today.getTime() ? "today" : "soon"

      const item: DigestItem = { planId: t.plan.id, planName: t.plan.name, title: t.title, dueDate: due, priority: t.priority, taskId: t.id }

      const recipientEmails = new Set<string>()
      for (const a of t.assignees) if (a.calisan.email) recipientEmails.add(a.calisan.email)
      for (const d of t.departments) for (const email of membersByDept.get(d.departmentName) ?? []) recipientEmails.add(email)

      for (const email of recipientEmails) addItem(email, bucket, item)
    }

    const resend = getResend()
    const appUrl = getAppPublicUrl()
    let sent = 0
    let failed = 0

    for (const [email, groups] of byRecipient) {
      const html = buildDigestHtml(groups, appUrl)
      const subjectParts: string[] = []
      if (groups.overdue.length) subjectParts.push(`${groups.overdue.length} overdue`)
      if (groups.today.length) subjectParts.push(`${groups.today.length} due today`)
      if (groups.soon.length) subjectParts.push(`${groups.soon.length} due soon`)
      const subject = `Planner: ${subjectParts.join(", ")}`

      const result = await sendHtmlEmail(resend, [email], subject, html, "cron/planner-reminders")
      if ("skipped" in result) continue
      sent += result.sent
      failed += result.failed
    }

    return NextResponse.json({ recipients: byRecipient.size, tasks: tasks.length, sent, failed })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[cron/planner-reminders] failed:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function buildDigestHtml(groups: Record<Bucket, DigestItem[]>, appUrl: string): string {
  const section = (title: string, color: string, items: DigestItem[]) => {
    if (items.length === 0) return ""
    const rows = items
      .map(
        (it) => `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(it.title)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(it.planName)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(it.priority)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${it.dueDate.toLocaleDateString("tr-TR")}</td>
        </tr>`
      )
      .join("")
    return `
      <h3 style="color:${color};margin:16px 0 6px;">${title} (${items.length})</h3>
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead><tr style="text-align:left;color:#6b7280;">
          <th style="padding:6px 10px;">Task</th><th style="padding:6px 10px;">Plan</th>
          <th style="padding:6px 10px;">Priority</th><th style="padding:6px 10px;">Due</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`
  }

  return `
    <div style="font-family:sans-serif;color:#111827;">
      <p>Merhaba, Planner'da yaklaşan/geciken görevleriniz var:</p>
      ${section("Overdue", "#dc2626", groups.overdue)}
      ${section("Due Today", "#d97706", groups.today)}
      ${section("Due Soon", "#b45309", groups.soon)}
      <p style="margin-top:20px;"><a href="${escapeHtml(appUrl)}/planner">Planner'ı aç</a></p>
    </div>`
}
