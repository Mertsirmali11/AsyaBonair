"use client"

import { createClient } from "@supabase/supabase-js"
import { resolveCorrespondenceMimeForUpload } from "@/lib/allowed-document-uploads"

export type AuditSessionAttachmentRef = {
  path: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

let cachedClient: ReturnType<typeof createClient> | null = null

function getSupabaseBrowserClient() {
  if (cachedClient) return cachedClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      "Supabase istemci ortam değişkenleri eksik (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    )
  }
  cachedClient = createClient(url, key)
  return cachedClient
}

/** Denetim checklist maddesi eklerini doğrudan Supabase Storage'a yükler (Vercel gövde sınırını by-pass eder). */
export async function uploadAuditSessionAttachmentsDirect(
  sessionId: number,
  itemId: number,
  files: File[]
): Promise<AuditSessionAttachmentRef[]> {
  // GEÇİCİ TEŞHİS LOGU — root cause netleşince kaldırılacak (audit-session-client.tsx'teki
  // [AUDIT-UPLOAD] loglarıyla aynı gerekçeyle console.warn kullanılıyor, next.config.ts
  // prod build'de console.log/info/debug'ı siliyor).
  console.warn("[AUDIT-UPLOAD] helper-called", { sessionId, itemId, fileCount: files.length })
  if (files.length === 0) {
    console.warn("[AUDIT-UPLOAD] helper-return (files.length === 0, erken çıkış)", { sessionId, itemId })
    return []
  }

  const res = await fetch(`/api/audit-sessions/${sessionId}/items/${itemId}/attachments/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: files.map((f) => ({ name: f.name, size: f.size })) }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    bucket?: string
    uploads?: { originalName: string; fileName: string; path: string; signedUrl: string; token: string }[]
  }
  console.warn("[AUDIT-UPLOAD] signed-url-response", { sessionId, itemId, ok: res.ok, status: res.status, uploadCount: data.uploads?.length ?? 0 })
  if (!res.ok) {
    throw new Error(data.error || "Yükleme adresi alınamadı")
  }
  const uploads = data.uploads ?? []
  const bucket = data.bucket
  if (!bucket) {
    throw new Error("Sunucu depo (bucket) bilgisini döndürmedi")
  }

  const supabase = getSupabaseBrowserClient()
  const results: AuditSessionAttachmentRef[] = []
  for (let i = 0; i < files.length; i++) {
    const u = uploads[i]
    if (!u) throw new Error(`${files[i].name} için yükleme adresi alınamadı`)
    const contentType = resolveCorrespondenceMimeForUpload(files[i])
    console.warn("[AUDIT-UPLOAD] storage-upload-start", { sessionId, itemId, fileName: files[i].name, path: u.path })
    const { error } = await supabase.storage
      .from(bucket)
      .uploadToSignedUrl(u.path, u.token, files[i], { contentType })
    if (error) {
      throw new Error(`${files[i].name} yüklenemedi: ${error.message}`)
    }
    console.warn("[AUDIT-UPLOAD] storage-upload", { sessionId, itemId, fileName: files[i].name })
    const ref = { path: u.path, fileName: u.fileName, mimeType: contentType, sizeBytes: files[i].size }
    console.warn("[AUDIT-UPLOAD] ref-created", { sessionId, itemId, ref })
    results.push(ref)
  }
  console.warn("[AUDIT-UPLOAD] helper-return", { sessionId, itemId, resultCount: results.length })
  return results
}
