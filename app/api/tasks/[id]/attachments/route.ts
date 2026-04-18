import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { isAdminDepartment } from "@/lib/department-access"

const MAX_BYTES = 50 * 1024 * 1024

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-()\s]+/g, "_").slice(0, 200) || "file"
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { id: idParam } = await params
    const taskId = Number.parseInt(idParam, 10)
    if (Number.isNaN(taskId)) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 })
    }

    const task = await prisma.meetingTask.findUnique({ where: { id: taskId } })
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    if (task.status === "Completed") {
      return NextResponse.json({ error: "Tamamlanan göreve dosya eklenemez." }, { status: 400 })
    }

    const calisan = await prisma.calisan.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!calisan) {
      return NextResponse.json({ error: "User not found" }, { status: 403 })
    }

    const staff =
      session.user.departman === "Quality" || isAdminDepartment(session.user.departman)
    const isAssignee = task.assigneeId != null && task.assigneeId === calisan.id

    if (!staff && !isAssignee) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (isAssignee && task.status === "Pending Review") {
      return NextResponse.json(
        { error: "Atayan değerlendirme yapana kadar yeni dosya eklenemez." },
        { status: 400 }
      )
    }

    const formData = await req.formData()
    const file = formData.get("file")
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
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

    const safeName = sanitizeFileName(file.name)
    const storagePath = `tasks/${taskId}/attachments/${Date.now()}_${safeName}`
    const bytes = await file.arrayBuffer()

    const { error: uploadError } = await supabase.storage
      .from("Aircraft-Manuals")
      .upload(storagePath, bytes, { contentType: file.type || "application/octet-stream" })

    if (uploadError) {
      console.error("[task attachment upload]", uploadError)
      return NextResponse.json({ error: "Upload failed" }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from("Aircraft-Manuals")
      .getPublicUrl(storagePath)

    const created = await prisma.taskAttachment.create({
      data: {
        taskId,
        fileName: file.name,
        filePath: urlData.publicUrl,
        fileSize: file.size,
        fileType: file.type || null,
        uploadedBy: calisan.id,
      },
    })

    if (
      isAssignee &&
      (task.status === "Pending Assessment" ||
        task.status === "Revision Requested" ||
        task.status === "Open" ||
        task.status === "In Progress")
    ) {
      await prisma.meetingTask.update({
        where: { id: taskId },
        data: { status: "Pending Review", rejectionReason: null },
      })
    }

    return NextResponse.json({
      id: created.id,
      fileName: created.fileName,
      filePath: created.filePath,
      fileSize: created.fileSize,
      createdAt: created.createdAt.toISOString(),
    })
  } catch (e) {
    console.error("[POST /api/tasks/[id]/attachments]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not upload attachment" },
      { status: 500 }
    )
  }
}
