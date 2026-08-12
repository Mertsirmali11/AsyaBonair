import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { calisanFullName, canManagePlan, resolvePlannerTaskAccess } from "@/lib/planner-access"
import { logPlannerTaskHistory } from "@/lib/planner-task-history"
import { maybeCreateNextOccurrence } from "@/lib/planner-recurrence"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/** GET: task tam detayı — checklist, yorumlar, ekler, geçmiş, atananlar. Plan üyeliği yeterli (görüntüleme herkese açık; düzenleme canEdit gerektirir). */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth()
  const { id } = await ctx.params
  const taskId = Number(id)
  if (!Number.isInteger(taskId) || taskId < 1) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const access = await resolvePlannerTaskAccess(taskId, session?.user?.email)
  if (!access || !access.isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const task = await prisma.plannerTask.findUnique({
    where: { id: taskId, deletedAt: null },
    include: {
      assignees: { include: { calisan: { select: { id: true, isim: true, soyisim: true } } } },
      departments: true,
      checklistItems: { orderBy: { sortOrder: "asc" } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { isim: true, soyisim: true } } } },
      attachments: { orderBy: { createdAt: "desc" }, include: { uploader: { select: { isim: true, soyisim: true } } } },
      history: { orderBy: { createdAt: "desc" }, include: { actor: { select: { isim: true, soyisim: true } } } },
      creator: { select: { isim: true, soyisim: true } },
      recurrenceParent: { select: { id: true, title: true } },
      recurrenceChildren: { select: { id: true, title: true, createdAt: true } },
    },
  })
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    id: task.id,
    planId: task.planId,
    bucketId: task.bucketId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    labels: task.labels,
    startDate: task.startDate ? task.startDate.toISOString() : null,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    recurrenceRule: task.recurrenceRule,
    recurrenceIntervalDays: task.recurrenceIntervalDays,
    recurrenceParent: task.recurrenceParent,
    recurrenceChildren: task.recurrenceChildren.map((c) => ({ id: c.id, title: c.title, createdAt: c.createdAt.toISOString() })),
    createdByName: calisanFullName(task.creator),
    createdAt: task.createdAt.toISOString(),
    canEdit: access.canEdit,
    canDelete: canManagePlan(access.role),
    assignees: task.assignees.map((a) => ({ id: a.calisanId, name: calisanFullName(a.calisan) })),
    departments: task.departments.map((d) => d.departmentName),
    checklist: task.checklistItems.map((c) => ({ id: c.id, label: c.label, isDone: c.isDone, sortOrder: c.sortOrder })),
    comments: task.comments.map((c) => ({ id: c.id, body: c.body, authorName: calisanFullName(c.author), createdAt: c.createdAt.toISOString() })),
    attachments: task.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      fileSizeBytes: a.fileSizeBytes,
      uploadedByName: calisanFullName(a.uploader),
      createdAt: a.createdAt.toISOString(),
    })),
    history: task.history.map((h) => ({
      id: h.id,
      eventType: h.eventType,
      note: h.note,
      actorName: calisanFullName(h.actor),
      createdAt: h.createdAt.toISOString(),
    })),
  })
}

/**
 * PATCH: task alanlarını günceller (title/description/priority/status/dates/labels),
 * bucket taşıma + sıra (drag&drop — hem bucket değişimi hem aynı bucket içi sıralama
 * TEK istekle anında kalıcı olur), ve atama (assigneeIds/departmentNames — BİRİ
 * DİĞERİNİ ETKİLEMEZ, yalnızca body'de gönderilen alan güncellenir). Departmana
 * atanmış bir task'ta işlemi yapan HER ZAMAN gerçek kullanıcı olarak history'ye yazılır.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth()
  const { id } = await ctx.params
  const taskId = Number(id)
  if (!Number.isInteger(taskId) || taskId < 1) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const access = await resolvePlannerTaskAccess(taskId, session?.user?.email)
  if (!access || !access.canEdit || !access.calisan) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const existing = await prisma.plannerTask.findUnique({
    where: { id: taskId, deletedAt: null },
    include: { assignees: true, departments: true },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = (await req.json().catch(() => null)) as {
    title?: string
    description?: string | null
    priority?: string
    status?: string
    bucketId?: number
    sortOrder?: number
    startDate?: string | null
    dueDate?: string | null
    labels?: string[]
    assigneeIds?: number[]
    departmentNames?: string[]
    recurrenceRule?: string | null
    recurrenceIntervalDays?: number | null
  } | null
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const actorId = access.calisan.id
  const data: Record<string, unknown> = {}
  const historyEvents: { eventType: string; note: string }[] = []

  if (typeof body.title === "string" && body.title.trim() && body.title.trim() !== existing.title) {
    data.title = body.title.trim()
    historyEvents.push({ eventType: "TITLE_CHANGED", note: `Başlık "${existing.title}" → "${data.title}" olarak değiştirildi.` })
  }
  if (body.description !== undefined) {
    const newDesc = typeof body.description === "string" ? body.description.trim() || null : null
    if (newDesc !== existing.description) data.description = newDesc
  }
  if (typeof body.priority === "string" && body.priority && body.priority !== existing.priority) {
    data.priority = body.priority
    historyEvents.push({ eventType: "PRIORITY_CHANGED", note: `Öncelik "${existing.priority}" → "${body.priority}" olarak değiştirildi.` })
  }
  if (typeof body.status === "string" && body.status && body.status !== existing.status) {
    data.status = body.status
    if (body.status === "Completed") {
      data.completedAt = new Date()
      historyEvents.push({ eventType: "COMPLETED", note: "Görev tamamlandı." })
    } else if (existing.status === "Completed") {
      data.completedAt = null
      historyEvents.push({ eventType: "REOPENED", note: `Görev yeniden açıldı (durum: ${body.status}).` })
    } else {
      historyEvents.push({ eventType: "STATUS_CHANGED", note: `Durum "${existing.status}" → "${body.status}" olarak değiştirildi.` })
    }
  }
  if (typeof body.bucketId === "number" && body.bucketId !== existing.bucketId) {
    const targetBucket = await prisma.plannerBucket.findFirst({ where: { id: body.bucketId, planId: existing.planId, deletedAt: null } })
    if (!targetBucket) return NextResponse.json({ error: "Geçersiz bucket." }, { status: 400 })
    data.bucketId = body.bucketId
    historyEvents.push({ eventType: "MOVED_BUCKET", note: `"${targetBucket.name}" bucket'ına taşındı.` })
  }
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    data.sortOrder = body.sortOrder
  }
  if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null
  if (body.dueDate !== undefined) {
    const newDue = body.dueDate ? new Date(body.dueDate) : null
    const oldDue = existing.dueDate
    const changed = (newDue?.getTime() ?? null) !== (oldDue?.getTime() ?? null)
    data.dueDate = newDue
    if (changed) {
      historyEvents.push({
        eventType: "DUE_DATE_CHANGED",
        note: `Bitiş tarihi ${oldDue ? oldDue.toLocaleDateString("tr-TR") : "—"} → ${newDue ? newDue.toLocaleDateString("tr-TR") : "—"} olarak değiştirildi.`,
      })
    }
  }
  if (Array.isArray(body.labels)) {
    data.labels = [...new Set(body.labels.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean))]
  }
  if (body.recurrenceRule !== undefined) {
    data.recurrenceRule = body.recurrenceRule && body.recurrenceRule !== "NONE" ? body.recurrenceRule : null
    data.recurrenceIntervalDays = data.recurrenceRule === "CUSTOM" ? (body.recurrenceIntervalDays ?? null) : null
  }

  // Bireysel atama — yalnızca body'de gönderilmişse dokunulur, departmentNames'i ETKİLEMEZ.
  if (Array.isArray(body.assigneeIds)) {
    const newIds = new Set([...new Set(body.assigneeIds.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))])
    const oldIds = new Set(existing.assignees.map((a) => a.calisanId))
    const toAdd = [...newIds].filter((n) => !oldIds.has(n))
    const toRemove = [...oldIds].filter((n) => !newIds.has(n))
    if (toAdd.length > 0 || toRemove.length > 0) {
      await prisma.plannerTaskAssignee.deleteMany({ where: { taskId, calisanId: { in: toRemove } } })
      await prisma.plannerTaskAssignee.createMany({
        data: toAdd.map((calisanId) => ({ taskId, calisanId })),
        skipDuplicates: true,
      })
      if (toAdd.length > 0) {
        const names = await prisma.calisan.findMany({ where: { id: { in: toAdd } }, select: { isim: true, soyisim: true } })
        historyEvents.push({ eventType: "ASSIGNED", note: `Atanan: ${names.map(calisanFullName).join(", ")}` })
      }
      if (toRemove.length > 0) {
        historyEvents.push({ eventType: "UNASSIGNED", note: `${toRemove.length} kişinin ataması kaldırıldı.` })
      }
    }
  }

  // Departman/grup ataması — bireysel atamadan BAĞIMSIZ, yalnızca gönderilmişse dokunulur.
  if (Array.isArray(body.departmentNames)) {
    const newNames = new Set(body.departmentNames.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean))
    const oldNames = new Set(existing.departments.map((d) => d.departmentName))
    const toAdd = [...newNames].filter((n) => !oldNames.has(n))
    const toRemove = [...oldNames].filter((n) => !newNames.has(n))
    if (toAdd.length > 0 || toRemove.length > 0) {
      await prisma.plannerTaskDepartment.deleteMany({ where: { taskId, departmentName: { in: toRemove } } })
      await prisma.plannerTaskDepartment.createMany({
        data: toAdd.map((departmentName) => ({ taskId, departmentName })),
        skipDuplicates: true,
      })
      if (toAdd.length > 0) historyEvents.push({ eventType: "DEPARTMENT_ASSIGNED", note: `Departman/Grup atandı: ${toAdd.join(", ")}` })
      if (toRemove.length > 0) historyEvents.push({ eventType: "DEPARTMENT_UNASSIGNED", note: `Departman/Grup ataması kaldırıldı: ${toRemove.join(", ")}` })
    }
  }

  const updated = Object.keys(data).length > 0 ? await prisma.plannerTask.update({ where: { id: taskId }, data }) : existing

  try {
    for (const ev of historyEvents) {
      await logPlannerTaskHistory(taskId, actorId, ev.eventType, ev.note)
    }
  } catch {
    // Geçmiş kaydı başarısız olsa bile güncelleme geçerli kalır
  }

  // Recurring task Completed olduğunda sonraki occurrence'ı oluştur — yalnızca
  // ŞABLON kopyalanır (comment/attachment ASLA), yeni kayıt recurrenceParentId ile bağlanır.
  if (data.status === "Completed" && existing.recurrenceRule) {
    try {
      await maybeCreateNextOccurrence(taskId, actorId)
    } catch {
      // Occurrence oluşturma başarısız olsa bile tamamlama geçerli kalır
    }
  }

  return NextResponse.json({ id: updated.id, status: updated.status, bucketId: updated.bucketId, sortOrder: updated.sortOrder })
}

/** DELETE: task'ı SOFT DELETE eder — OWNER/MANAGER gerektirir, history asla kaybolmaz. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth()
  const { id } = await ctx.params
  const taskId = Number(id)
  if (!Number.isInteger(taskId) || taskId < 1) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const access = await resolvePlannerTaskAccess(taskId, session?.user?.email)
  if (!access || !access.isMember || !canManagePlan(access.role) || !access.calisan) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const existing = await prisma.plannerTask.findUnique({ where: { id: taskId, deletedAt: null }, select: { title: true } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.plannerTask.update({ where: { id: taskId }, data: { deletedAt: new Date() } })
  try {
    await logPlannerTaskHistory(taskId, access.calisan.id, "DELETED", `Task "${existing.title}" silindi.`)
  } catch {
    // Geçmiş kaydı başarısız olsa bile silme geçerli kalır
  }

  return NextResponse.json({ ok: true })
}
