import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { calisanFullName, canManagePlan, resolvePlannerPlanAccess } from "@/lib/planner-access"
import { logPlannerTaskHistory } from "@/lib/planner-task-history"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

const VALID_RECURRENCE = ["NONE", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "YEARLY", "CUSTOM"]

/** GET: plandaki tüm aktif (silinmemiş) task'lar — Board'un tek veri kaynağı. */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth()
  const { id } = await ctx.params
  const planId = Number(id)
  if (!Number.isInteger(planId) || planId < 1) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const access = await resolvePlannerPlanAccess(planId, session?.user?.email)
  if (!access.isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const tasks = await prisma.plannerTask.findMany({
    where: { planId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
    include: {
      assignees: { include: { calisan: { select: { id: true, isim: true, soyisim: true } } } },
      departments: true,
      checklistItems: { select: { isDone: true } },
      _count: { select: { comments: true, attachments: true } },
    },
  })

  return NextResponse.json(
    tasks.map((t) => ({
      id: t.id,
      bucketId: t.bucketId,
      title: t.title,
      description: t.description,
      sortOrder: t.sortOrder,
      status: t.status,
      priority: t.priority,
      labels: t.labels,
      startDate: t.startDate ? t.startDate.toISOString() : null,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      recurrenceRule: t.recurrenceRule,
      assignees: t.assignees.map((a) => ({ id: a.calisanId, name: calisanFullName(a.calisan) })),
      departments: t.departments.map((d) => d.departmentName),
      checklistTotal: t.checklistItems.length,
      checklistDone: t.checklistItems.filter((c) => c.isDone).length,
      commentCount: t._count.comments,
      attachmentCount: t._count.attachments,
    }))
  )
}

/** POST: yeni task oluşturur — OWNER/MANAGER gerektirir (spec: "task oluşturma" Owner/Manager yetkisi). */
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth()
  const { id } = await ctx.params
  const planId = Number(id)
  if (!Number.isInteger(planId) || planId < 1) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const access = await resolvePlannerPlanAccess(planId, session?.user?.email)
  if (!access.isMember || !canManagePlan(access.role) || !access.calisan) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as {
    title?: string
    description?: string
    bucketId?: number
    priority?: string
    status?: string
    startDate?: string
    dueDate?: string
    labels?: string[]
    assigneeIds?: number[]
    departmentNames?: string[]
    recurrenceRule?: string
    recurrenceIntervalDays?: number
  } | null

  const title = typeof body?.title === "string" ? body.title.trim() : ""
  if (!title) return NextResponse.json({ error: "Başlık zorunludur." }, { status: 400 })

  const bucketId = Number(body?.bucketId)
  const bucket = await prisma.plannerBucket.findFirst({ where: { id: bucketId, planId, deletedAt: null } })
  if (!bucket) return NextResponse.json({ error: "Geçersiz bucket." }, { status: 400 })

  const recurrenceRule =
    typeof body?.recurrenceRule === "string" && VALID_RECURRENCE.includes(body.recurrenceRule) && body.recurrenceRule !== "NONE"
      ? body.recurrenceRule
      : null
  const recurrenceIntervalDays =
    recurrenceRule === "CUSTOM" && Number.isInteger(body?.recurrenceIntervalDays) && (body!.recurrenceIntervalDays as number) > 0
      ? body!.recurrenceIntervalDays
      : null

  const assigneeIds = Array.isArray(body?.assigneeIds)
    ? [...new Set(body!.assigneeIds.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))]
    : []
  const departmentNames = Array.isArray(body?.departmentNames)
    ? [...new Set(body!.departmentNames.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean))]
    : []
  const labels = Array.isArray(body?.labels)
    ? [...new Set(body!.labels.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean))]
    : []

  const maxOrder = await prisma.plannerTask.aggregate({
    where: { bucketId, deletedAt: null },
    _max: { sortOrder: true },
  })

  const task = await prisma.plannerTask.create({
    data: {
      planId,
      bucketId,
      title,
      description: typeof body?.description === "string" ? body.description.trim() || null : null,
      priority: typeof body?.priority === "string" && body.priority ? body.priority : "Medium",
      status: typeof body?.status === "string" && body.status ? body.status : "Not Started",
      startDate: body?.startDate ? new Date(body.startDate) : null,
      dueDate: body?.dueDate ? new Date(body.dueDate) : null,
      labels,
      recurrenceRule,
      recurrenceIntervalDays,
      createdBy: access.calisan.id,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      assignees: { create: assigneeIds.map((calisanId) => ({ calisanId })) },
      departments: { create: departmentNames.map((departmentName) => ({ departmentName })) },
    },
  })

  try {
    await logPlannerTaskHistory(task.id, access.calisan.id, "CREATED", `Task "${title}" oluşturuldu.`)
  } catch {
    // Geçmiş kaydı başarısız olsa bile task oluşturma geçerli kalır
  }

  return NextResponse.json({ id: task.id }, { status: 201 })
}
