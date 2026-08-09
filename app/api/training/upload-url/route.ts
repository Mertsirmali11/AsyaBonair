import { NextResponse } from "next/server"

import { assertCanManageTraining } from "@/lib/training-access"
import {
  CORRESPONDENCE_ALLOWED_ERROR_EN,
  assignUniqueDocumentStorageNamesFromNames,
  isAllowedCorrespondenceDocumentOrImageFileName,
} from "@/lib/allowed-document-uploads"
import { createSignedUploadUrl, getStorageBucket } from "@/lib/supabase-storage"

export const dynamic = "force-dynamic"

const MAX_BYTES = 20 * 1024 * 1024

/**
 * Eğitim sertifikası için imzalı Supabase upload URL'i — tarayıcı dosyayı
 * doğrudan Supabase'e yükler, Vercel fonksiyonunun gövde sınırından geçmez.
 */
export async function POST(request: Request) {
  const gate = await assertCanManageTraining()
  if (!gate.ok) return gate.response

  const body = (await request.json().catch(() => null)) as {
    name?: string
    size?: number
  } | null
  const name = String(body?.name ?? "").trim()
  const size = Number(body?.size) || 0

  if (!name) {
    return NextResponse.json({ error: "No file" }, { status: 400 })
  }
  if (size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Dosya çok büyük (en fazla ${MAX_BYTES / (1024 * 1024)} MB).` },
      { status: 400 }
    )
  }
  if (!isAllowedCorrespondenceDocumentOrImageFileName(name)) {
    return NextResponse.json({ error: CORRESPONDENCE_ALLOWED_ERROR_EN }, { status: 400 })
  }

  const [finalName] = assignUniqueDocumentStorageNamesFromNames([name])
  const batchId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`
  const path = `training-certificates/${batchId}/${finalName}`

  const result = await createSignedUploadUrl(path)
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 })
  }

  return NextResponse.json({
    fileName: finalName,
    path: result.path,
    signedUrl: result.signedUrl,
    token: result.token,
    bucket: getStorageBucket(),
  })
}
