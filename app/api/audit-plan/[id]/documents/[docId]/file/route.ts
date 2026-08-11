import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { prisma } from "@/lib/prisma-server"
import { createSignedDownloadUrl } from "@/lib/supabase-storage"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string; docId: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id, docId } = await ctx.params
  const entryId = Number(id)
  const documentId = Number(docId)
  if (!Number.isInteger(entryId) || !Number.isInteger(documentId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const doc = await prisma.auditPlanDocument.findFirst({
    where: { id: documentId, auditPlanEntryId: entryId },
  })
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const signed = await createSignedDownloadUrl(doc.storagePath)
  if (!signed.ok) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  return NextResponse.redirect(signed.url)
}
