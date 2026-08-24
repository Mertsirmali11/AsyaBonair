import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"
import { createSignedDownloadUrl } from "@/lib/supabase-storage"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string; fileId: string }> }

/** GET: bir Audit Plan revizyon dosyasını indirir — audit-plan/[id]/documents/[docId]/file ile aynı desen. */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id, fileId } = await ctx.params
  const revisionId = Number(id)
  const fileIdNum = Number(fileId)
  if (!Number.isInteger(revisionId) || !Number.isInteger(fileIdNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const file = await prisma.auditPlanRevisionFile.findFirst({
    where: { id: fileIdNum, revisionId },
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
