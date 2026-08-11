import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"
import {
  CORRESPONDENCE_ALLOWED_ERROR_EN,
  assignUniqueDocumentStorageNamesFromNames,
  isAllowedCorrespondenceDocumentOrImageFileName,
} from "@/lib/allowed-document-uploads"
import { createSignedUploadUrl, getStorageBucket } from "@/lib/supabase-storage"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string; itemId: string }> }

const MAX_BYTES = 30 * 1024 * 1024

/**
 * Denetim checklist maddesi eki için imzalı Supabase upload URL'i — tarayıcı
 * dosyayı doğrudan Supabase'e yükler, Vercel fonksiyonunun ~4.5MB gövde
 * sınırından geçmez (taranmış kanıt/fotoğraf dosyaları bu sınırı kolayca aşar).
 */
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

  const body = (await req.json().catch(() => null)) as {
    files?: { name: string; size: number }[]
  } | null
  const files = Array.isArray(body?.files) ? body!.files : []
  if (files.length === 0) {
    return NextResponse.json({ error: "No files" }, { status: 400 })
  }
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
    if (!name || !isAllowedCorrespondenceDocumentOrImageFileName(name)) {
      return NextResponse.json({ error: CORRESPONDENCE_ALLOWED_ERROR_EN }, { status: 400 })
    }
  }

  const finalNames = assignUniqueDocumentStorageNamesFromNames(names)
  const folderPrefix = `audit-session-attachments/${sessionId}/${sessionItemId}`

  const uploads: {
    originalName: string
    fileName: string
    path: string
    signedUrl: string
    token: string
  }[] = []

  for (let i = 0; i < files.length; i++) {
    const uid =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const path = `${folderPrefix}/${uid}_${finalNames[i]}`
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
