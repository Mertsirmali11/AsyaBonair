import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import {
  CORRESPONDENCE_ALLOWED_ERROR_EN,
  assignUniqueDocumentStorageNamesFromNames,
  isAllowedCorrespondenceDocumentOrImageFileName,
} from "@/lib/allowed-document-uploads"
import { createSignedUploadUrl, getStorageBucket } from "@/lib/supabase-storage"

export const dynamic = "force-dynamic"

const MAX_FILES = 10
const MAX_TOTAL_BYTES = 50 * 1024 * 1024

/**
 * Gelen/Giden Evrak ekleri için imzalı Supabase upload URL'leri üretir.
 * Tarayıcı dosyayı buradan aldığı URL'e DOĞRUDAN Supabase'e yükler — bu route
 * yalnızca küçük bir JSON isteği/yanıtı taşır, dosya binary'si hiç buraya uğramaz.
 * (Vercel serverless fonksiyonlarının ~4.5MB istek gövdesi sınırını by-pass eder.)
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccessConfigurationsArea(session.user?.departman)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as {
    files?: { name: string; size: number }[]
  } | null
  const files = Array.isArray(body?.files) ? body!.files : []

  if (files.length === 0) {
    return NextResponse.json({ error: "No files" }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Too many files (max ${MAX_FILES})` }, { status: 400 })
  }

  const totalBytes = files.reduce((s, f) => s + (Number(f?.size) || 0), 0)
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: "Total attachment size must not exceed 50MB" },
      { status: 400 }
    )
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
    const path = `pending-correspondence/${batchId}/${finalNames[i]}`
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
