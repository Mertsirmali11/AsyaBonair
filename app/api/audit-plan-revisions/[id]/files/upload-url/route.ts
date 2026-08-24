import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import {
  CORRESPONDENCE_ALLOWED_ERROR_EN,
  assignUniqueDocumentStorageNamesFromNames,
  isAllowedCorrespondenceDocumentOrImageFileName,
} from "@/lib/allowed-document-uploads"
import { createSignedUploadUrl, getStorageBucket } from "@/lib/supabase-storage"
import { prisma } from "@/lib/prisma-server"

export const dynamic = "force-dynamic"

const MAX_BYTES = 30 * 1024 * 1024
const MAX_FILES = 10

type Ctx = { params: Promise<{ id: string }> }

/**
 * Bir Audit Plan revizyonuna eklenecek dosyalar için imzalı Supabase upload URL'i —
 * app/api/audit-plan/[id]/documents/upload-url/route.ts ile BİREBİR AYNI desen, yalnızca
 * storage path prefix'i farklı (audit-plan-revisions/... vs audit-plan-documents/...).
 */
export async function POST(req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params
  const revisionId = Number(id)
  if (!Number.isInteger(revisionId) || revisionId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const revision = await prisma.auditPlanRevision.findUnique({
    where: { id: revisionId },
    select: { id: true },
  })
  if (!revision) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = (await req.json().catch(() => null)) as {
    files?: { name: string; size: number }[]
  } | null
  const files = Array.isArray(body?.files) ? body!.files : []

  if (files.length === 0) {
    return NextResponse.json({ error: "No files" }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Too many files (max ${MAX_FILES})` }, { status: 400 })
  }
  for (const f of files) {
    if ((Number(f?.size) || 0) > MAX_BYTES) {
      return NextResponse.json(
        { error: `Dosya çok büyük (en fazla ${MAX_BYTES / (1024 * 1024)} MB): ${f?.name ?? ""}` },
        { status: 400 }
      )
    }
  }

  const names = files.map((f) => String(f?.name ?? "").trim())
  for (const name of names) {
    if (!name || !isAllowedCorrespondenceDocumentOrImageFileName(name)) {
      return NextResponse.json({ error: CORRESPONDENCE_ALLOWED_ERROR_EN }, { status: 400 })
    }
  }

  const finalNames = assignUniqueDocumentStorageNamesFromNames(names)
  const batchId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`

  const uploads: {
    originalName: string
    fileName: string
    path: string
    signedUrl: string
    token: string
  }[] = []

  for (let i = 0; i < files.length; i++) {
    const path = `audit-plan-revisions/${revisionId}/${batchId}/${finalNames[i]}`
    const result = await createSignedUploadUrl(path)
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 500 })
    }
    uploads.push({
      originalName: names[i],
      fileName: finalNames[i],
      path: result.path,
      signedUrl: result.signedUrl,
      token: result.token,
    })
  }

  return NextResponse.json({ uploads, bucket: getStorageBucket() })
}
