import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolvePlannerTaskAccess } from "@/lib/planner-access"
import { prisma } from "@/lib/prisma-server"
import { createSignedDownloadUrl } from "@/lib/supabase-storage"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string; attachmentId: string }> }

/** GET: eke imzalı Supabase indirme URL'ine yönlendirir — dosya baytları Vercel fonksiyonundan geçmez. */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth()
  const { id, attachmentId } = await ctx.params
  const taskId = Number(id)
  const attachmentIdNum = Number(attachmentId)
  if (!Number.isInteger(taskId) || !Number.isInteger(attachmentIdNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const access = await resolvePlannerTaskAccess(taskId, session?.user?.email)
  if (!access || !access.isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const attachment = await prisma.plannerTaskAttachment.findFirst({ where: { id: attachmentIdNum, taskId } })
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const signed = await createSignedDownloadUrl(attachment.storagePath)
  if (!signed.ok) return NextResponse.json({ error: "File not found" }, { status: 404 })

  return NextResponse.redirect(signed.url)
}
