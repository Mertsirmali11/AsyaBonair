import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolveFindingAuditeeAccess } from "@/lib/audit-finding-auditee-access"
import { prisma } from "@/lib/prisma-server"
import {
  FINDING_FILE_ALLOWED_ERROR_EN,
  assignUniqueDocumentStorageNamesFromNames,
  isAllowedFindingFileName,
} from "@/lib/allowed-document-uploads"
import { createSignedUploadUrl, getStorageBucket } from "@/lib/supabase-storage"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

const MAX_BYTES = 30 * 1024 * 1024

/**
 * Finding Files için imzalı Supabase upload URL'i — tarayıcı dosyayı doğrudan Supabase'e
 * yükler, Vercel fonksiyonunun ~4.5MB gövde sınırından geçmez. Admin veya bu bulguya
 * (bireysel/departman) erişimi olan auditee yükleyebilir.
 */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const findingId = Number(id)
  if (!Number.isInteger(findingId) || findingId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const authSession = await auth()
  const access = await resolveFindingAuditeeAccess(findingId, authSession?.user?.email, authSession?.user?.departman)
  if (!access.isAdmin && !access.isAuditee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const finding = await prisma.auditFinding.findUnique({ where: { id: findingId }, select: { id: true, deletedAt: true } })
  if (!finding || finding.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = (await req.json().catch(() => null)) as { files?: { name: string; size: number }[] } | null
  const files = Array.isArray(body?.files) ? body!.files : []
  if (files.length === 0) return NextResponse.json({ error: "No files" }, { status: 400 })
  for (const f of files) {
    if ((Number(f?.size) || 0) > MAX_BYTES) {
      return NextResponse.json(
        { error: `Dosya çok büyük (en fazla ${MAX_BYTES / (1024 * 1024)} MB): ${f?.name ?? ""}` },
        { status: 413 }
      )
    }
  }

  const names = files.map((f) => String(f?.name ?? "").trim())
  for (const name of names) {
    if (!name || !isAllowedFindingFileName(name)) {
      return NextResponse.json({ error: FINDING_FILE_ALLOWED_ERROR_EN }, { status: 400 })
    }
  }

  const finalNames = assignUniqueDocumentStorageNamesFromNames(names)
  const folderPrefix = `audit-finding-files/${findingId}`
  const uploads: { originalName: string; fileName: string; path: string; signedUrl: string; token: string }[] = []

  for (let i = 0; i < files.length; i++) {
    const uid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const path = `${folderPrefix}/${uid}_${finalNames[i]}`
    const result = await createSignedUploadUrl(path)
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 500 })
    uploads.push({ originalName: names[i], fileName: finalNames[i], path: result.path, signedUrl: result.signedUrl, token: result.token })
  }

  return NextResponse.json({ uploads, bucket: getStorageBucket() })
}
