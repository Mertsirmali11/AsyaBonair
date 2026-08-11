import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string; itemId: string }> }

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

  // Tarayıcı dosyayı /upload-url üzerinden aldığı imzalı URL'e doğrudan
  // Supabase'e yükledikten sonra burada sadece metadata kaydedilir.
  const body = (await req.json().catch(() => null)) as {
    path?: string
    fileName?: string
    mimeType?: string
    sizeBytes?: number
    uploadedBy?: string
  } | null

  const path = typeof body?.path === "string" ? body.path : ""
  const fileName = typeof body?.fileName === "string" ? body.fileName : ""
  if (!path || !fileName) {
    return NextResponse.json({ error: "No file" }, { status: 400 })
  }

  // "auditor" or "auditee"
  const uploadedBy = body?.uploadedBy === "auditee" ? "auditee" : "auditor"

  const attachment = await prisma.auditSessionItemAttachment.create({
    data: {
      auditSessionItemId: sessionItemId,
      uploadedBy,
      fileName,
      storagePath: path,
      mimeType: typeof body?.mimeType === "string" ? body.mimeType : null,
      fileSizeBytes: typeof body?.sizeBytes === "number" ? body.sizeBytes : null,
    },
  })

  return NextResponse.json(attachment, { status: 201 })
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
