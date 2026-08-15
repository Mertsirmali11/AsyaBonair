import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { prisma } from "@/lib/prisma-server"
import { createSignedDownloadUrl } from "@/lib/supabase-storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string; submissionId: string; fileId: string }> }

/**
 * Manage Audit → Auditee Responses panelinde auditee'nin gönderdiği bir checklist ekini
 * indirmek için — yalnızca Audit Plan yönetici erişimi olan kullanıcılar. Public tarafta
 * indirme YOKTUR (auditee kendi gönderdiği dosyayı geri okuyamaz, yalnızca yükleyebilir).
 */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id, submissionId: submissionIdRaw, fileId: fileIdRaw } = await ctx.params
  const entryId = Number(id)
  const submissionId = Number(submissionIdRaw)
  const fileId = Number(fileIdRaw)
  if (
    !Number.isInteger(entryId) || entryId < 1 ||
    !Number.isInteger(submissionId) || submissionId < 1 ||
    !Number.isInteger(fileId) || fileId < 1
  ) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const file = await prisma.auditeeChecklistSubmissionFile.findFirst({
    where: {
      id: fileId,
      submissionId,
      submission: { sessionItem: { session: { auditPlanEntryId: entryId } } },
    },
    select: { storagePath: true },
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
