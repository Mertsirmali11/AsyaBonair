import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"
import { uploadBinaryToStorage } from "@/lib/supabase-storage"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

const MAX_BYTES = 30 * 1024 * 1024 // 30 MB

export async function POST(req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const responseIdRaw = formData.get("responseId")
  const responseId = Number(responseIdRaw)
  if (!Number.isInteger(responseId) || responseId < 1)
    return NextResponse.json({ error: "Invalid responseId" }, { status: 400 })

  // Verify response belongs to this finding
  const response = await prisma.auditFindingResponse.findFirst({
    where: { id: responseId, auditFindingId: id },
  })
  if (!response) return NextResponse.json({ error: "Response not found" }, { status: 404 })

  const file = formData.get("file")
  if (!file || !(file instanceof File))
    return NextResponse.json({ error: "No file provided" }, { status: 400 })

  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "File too large (max 30 MB)" }, { status: 413 })

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const safeName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/\s+/g, "_") || "attachment"

  const uid =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`

  const storageFileName = `${uid}_${safeName}`
  const folderPrefix = `audit-finding-attachments/${id}/${responseId}`

  const result = await uploadBinaryToStorage(
    folderPrefix,
    storageFileName,
    buffer,
    file.type || "application/octet-stream",
    { upsert: false }
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 })
  }

  const attachment = await prisma.auditFindingAttachment.create({
    data: {
      auditFindingResponseId: responseId,
      fileName: file.name,
      storagePath: result.path,
      mimeType: file.type || null,
      fileSizeBytes: file.size,
    },
  })

  return NextResponse.json({ ...attachment, publicUrl: result.publicUrl }, { status: 201 })
}
