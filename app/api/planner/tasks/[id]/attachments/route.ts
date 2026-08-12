import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolvePlannerTaskAccess } from "@/lib/planner-access"
import { logPlannerTaskHistory } from "@/lib/planner-task-history"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/** POST: tarayıcı dosyayı doğrudan Supabase'e yükledikten sonra metadata'yı burada kaydeder. */
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth()
  const { id } = await ctx.params
  const taskId = Number(id)
  if (!Number.isInteger(taskId) || taskId < 1) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const access = await resolvePlannerTaskAccess(taskId, session?.user?.email)
  if (!access || !access.canEdit || !access.calisan) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = (await req.json().catch(() => null)) as {
    files?: { path: string; fileName: string; mimeType?: string; sizeBytes?: number }[]
  } | null
  const files = Array.isArray(body?.files) ? body!.files : []
  const valid = files.filter(
    (f): f is { path: string; fileName: string; mimeType?: string; sizeBytes?: number } =>
      !!f && typeof f.path === "string" && typeof f.fileName === "string"
  )
  if (valid.length === 0) return NextResponse.json({ error: "No files" }, { status: 400 })

  await prisma.plannerTaskAttachment.createMany({
    data: valid.map((f) => ({
      taskId,
      fileName: f.fileName,
      storagePath: f.path,
      mimeType: f.mimeType ?? null,
      fileSizeBytes: typeof f.sizeBytes === "number" ? f.sizeBytes : null,
      uploadedBy: access.calisan!.id,
    })),
  })

  try {
    const names = valid.map((f) => f.fileName).join(", ")
    await logPlannerTaskHistory(taskId, access.calisan.id, "ATTACHMENT_ADDED", `${valid.length} dosya eklendi: ${names}`)
  } catch {
    // sessiz
  }

  return NextResponse.json({ created: valid.length }, { status: 201 })
}
