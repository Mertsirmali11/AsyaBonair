import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import {
  CORRESPONDENCE_ALLOWED_ERROR_EN,
  assignUniqueDocumentStorageNamesFromNames,
  isAllowedCorrespondenceDocumentOrImageFileName,
} from "@/lib/allowed-document-uploads"
import { createSignedUploadUrl, getStorageBucket } from "@/lib/supabase-storage"

export const dynamic = "force-dynamic"

const MAX_BYTES = 30 * 1024 * 1024
const MAX_FILES = 10

type Ctx = { params: Promise<{ id: string }> }

/**
 * Denetim kaydına doğrudan bağlı genel dosyalar (rapor, imzalı checklist vb.)
 * için imzalı Supabase upload URL'i — tarayıcı dosyayı doğrudan Supabase'e
 * yükler, Vercel fonksiyonunun gövde sınırından geçmez.
 */
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params
  const entryId = Number(id)
  if (!Number.isInteger(entryId) || entryId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
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
    const path = `audit-plan-documents/${entryId}/${batchId}/${finalNames[i]}`
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
