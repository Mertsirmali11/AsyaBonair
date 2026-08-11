import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolveFindingAuditeeAccess } from "@/lib/audit-finding-auditee-access"
import { prisma } from "@/lib/prisma-server"
import { createSignedDownloadUrl } from "@/lib/supabase-storage"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string; fileId: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const { id, fileId } = await ctx.params
  const findingId = Number(id)
  const fileIdNum = Number(fileId)
  if (!Number.isInteger(findingId) || !Number.isInteger(fileIdNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const authSession = await auth()
  const access = await resolveFindingAuditeeAccess(findingId, authSession?.user?.email, authSession?.user?.departman)
  if (!access.isAdmin && !access.isAuditee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const file = await prisma.auditFindingFile.findFirst({
    where: { id: fileIdNum, auditFindingId: findingId },
  })
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const signed = await createSignedDownloadUrl(file.storagePath)
  if (!signed.ok) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  return NextResponse.redirect(signed.url)
}
