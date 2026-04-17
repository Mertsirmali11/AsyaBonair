import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"
import { uploadBinaryToStorage } from "@/lib/supabase-storage"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string; itemId: string }> }

const MAX_BYTES = 30 * 1024 * 1024 // 30 MB

export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, itemId } = await ctx.params
  const sessionId = Number(id)
  const sessionItemId = Number(itemId)

  if (!Number.isInteger(sessionId) || sessionId < 1 || !Number.isInteger(sessionItemId) || sessionItemId < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const item = await prisma.auditSessionItem.findFirst({
    where: { id: sessionItemId, auditSessionId: sessionId },
  })
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })

  const attachments = await prisma.auditSessionItemAttachment.findMany({
    where: { auditSessionItemId: sessionItemId },
    orderBy: { uploadedAt: "asc" },
  })

  return NextResponse.json(attachments)
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, itemId } = await ctx.params
  const sessionId = Number(id)
  const sessionItemId = Number(itemId)

  if (!Number.isInteger(sessionId) || sessionId < 1 || !Number.isInteger(sessionItemId) || sessionItemId < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const item = await prisma.auditSessionItem.findFirst({
    where: { id: sessionItemId, auditSessionId: sessionId },
  })
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!file || !(file instanceof File))
    return NextResponse.json({ error: "No file provided" }, { status: 400 })

  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "File too large (max 30 MB)" }, { status: 413 })

  // "auditor" or "auditee"
  const uploadedBy = formData.get("uploadedBy") === "auditee" ? "auditee" : "auditor"

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
  const folderPrefix = `audit-session-attachments/${sessionId}/${sessionItemId}`

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

  const attachment = await prisma.auditSessionItemAttachment.create({
    data: {
      auditSessionItemId: sessionItemId,
      uploadedBy,
      fileName: file.name,
      storagePath: result.path,
      mimeType: file.type || null,
      fileSizeBytes: file.size,
    },
  })

  return NextResponse.json({ ...attachment, publicUrl: result.publicUrl }, { status: 201 })
}

export async function DELETE(req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, itemId } = await ctx.params
  const sessionId = Number(id)
  const sessionItemId = Number(itemId)

  const url = new URL(req.url)
  const attachmentId = Number(url.searchParams.get("attachmentId"))

  if (!Number.isInteger(attachmentId) || attachmentId < 1)
    return NextResponse.json({ error: "Invalid attachmentId" }, { status: 400 })

  const attachment = await prisma.auditSessionItemAttachment.findFirst({
    where: { id: attachmentId, auditSessionItemId: sessionItemId },
  })
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.auditSessionItemAttachment.delete({ where: { id: attachmentId } })
  return NextResponse.json({ ok: true })
}
