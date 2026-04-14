import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { isAdminDepartment } from "@/lib/department-access"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    // Viewing is allowed for Quality + Admin (existing behavior)
    if (session.user.departman !== "Quality" && !isAdminDepartment(session.user.departman)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: idParam } = await params
    const id = Number.parseInt(idParam, 10)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 })
    }

    const calisan = await prisma.calisan.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    const task = await prisma.meetingTask.findUnique({
      where: { id },
      include: {
        meeting: {
          select: {
            id: true,
            meetingNo: true,
            title: true,
            participants: {
              select: {
                calisan: { select: { isim: true, soyisim: true } },
              },
            },
          },
        },
        assignee: { select: { isim: true, soyisim: true } },
        assignedBy: { select: { id: true, isim: true, soyisim: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { isim: true, soyisim: true } } },
        },
        attachments: {
          orderBy: { createdAt: "asc" },
          take: 50,
          select: {
            id: true,
            fileName: true,
            filePath: true,
            fileSize: true,
            createdAt: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const name = (c: { isim: string | null; soyisim: string | null } | null) => {
      if (!c) return "Unknown"
      const n = `${c.isim ?? ""} ${c.soyisim ?? ""}`.trim()
      return n || "Unknown"
    }

    type Hist = { at: string; text: string }
    const history: Hist[] = [
      {
        at: task.createdAt.toISOString(),
        text: `Task was created — ${task.title}`,
      },
    ]
    for (const m of task.messages) {
      history.push({
        at: m.createdAt.toISOString(),
        text: `Message · ${name(m.sender)}`,
      })
    }
    for (const a of task.attachments) {
      history.push({
        at: a.createdAt.toISOString(),
        text: `Attachment added · ${a.fileName}`,
      })
    }
    history.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

    const assignedByName = task.assignedBy ? name(task.assignedBy) : null
    // Only Admin department may edit tasks (per requirement).
    const canEdit = isAdminDepartment(session.user.departman)

    return NextResponse.json({
      id: task.id,
      title: task.title,
      status: task.status,
      assigneeId: task.assigneeId,
      assignedById: task.assignedById ?? null,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      meetingId: task.meetingId,
      meeting: task.meeting
        ? {
            id: task.meeting.id,
            meetingNo: task.meeting.meetingNo,
            title: task.meeting.title,
          }
        : null,
      assignedByName,
      permissions: { canEdit },
      assignee: task.assignee,
      filePath: task.filePath,
      fileName: task.fileName,
      messages: task.messages.map((m) => ({
        id: m.id,
        message: m.message,
        createdAt: m.createdAt.toISOString(),
        sender: m.sender,
      })),
      attachments: task.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        filePath: a.filePath,
        fileSize: a.fileSize,
        createdAt: a.createdAt.toISOString(),
      })),
      history,
    })
  } catch (e) {
    console.error("[GET /api/tasks/[id]]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load task" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // Only Admin department may update tasks (per requirement).
  if (!isAdminDepartment(session.user.departman)) {
    return NextResponse.json({ error: "Only admin can update tasks" }, { status: 403 })
  }

  const task = await prisma.meetingTask.findUnique({
    where: { id: parseInt(id) },
    select: { id: true },
  })
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const contentType = req.headers.get("content-type") || ""

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const status = formData.get("status") as string | null

    let filePath: string | undefined
    let fileName: string | undefined

    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json(
          { error: "File must be 50 MB or smaller" },
          { status: 400 }
        )
      }
      const { createClient } = await import("@supabase/supabase-js")
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || "",
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const bytes = await file.arrayBuffer()
      const safeName = `${Date.now()}_${file.name}`
      const storagePath = `tasks/${id}/${safeName}`

      const { error } = await supabase.storage
        .from("Aircraft-Manuals")
        .upload(storagePath, bytes, { contentType: file.type })

      if (!error) {
        const { data: urlData } = supabase.storage
          .from("Aircraft-Manuals")
          .getPublicUrl(storagePath)
        filePath = urlData.publicUrl
        fileName = file.name
      }
    }

    const updated = await prisma.meetingTask.update({
      where: { id: parseInt(id) },
      data: {
        ...(status && { status }),
        ...(filePath && { filePath }),
        ...(fileName && { fileName }),
      },
      include: { assignee: { select: { isim: true, soyisim: true } } },
    })
    return NextResponse.json(updated)
  }

  const body = (await req.json()) as Record<string, unknown>
  const data: {
    status?: string
    dueDate?: Date | null
    assigneeId?: number | null
  } = {}

  if (typeof body.status === "string") data.status = body.status

  if ("dueDate" in body) {
    const d = body.dueDate
    if (d === null || d === "") data.dueDate = null
    else if (typeof d === "string") {
      data.dueDate = new Date(d.includes("T") ? d : `${d}T12:00:00`)
    }
  }

  if ("assigneeId" in body) {
    const a = body.assigneeId
    if (a === null || a === "") data.assigneeId = null
    else {
      const n = Number(a)
      if (!Number.isNaN(n)) data.assigneeId = n
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    )
  }

  const updated = await prisma.meetingTask.update({
    where: { id: parseInt(id) },
    data,
    include: { assignee: { select: { isim: true, soyisim: true } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.meetingTask.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ success: true })
}