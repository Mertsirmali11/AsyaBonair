"use client"

import { createClient } from "@supabase/supabase-js"
import { resolveCorrespondenceMimeForUpload } from "@/lib/allowed-document-uploads"

export type TrainingCertificateRef = { path: string; fileName: string }

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

/** Eğitim sertifikasını doğrudan Supabase Storage'a yükler (Vercel gövde sınırını by-pass eder). */
export async function uploadTrainingCertificateDirect(
  file: File
): Promise<TrainingCertificateRef> {
  const res = await fetch("/api/training/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    fileName?: string
    path?: string
    signedUrl?: string
    token?: string
    bucket?: string
  }
  if (!res.ok) {
    throw new Error(data.error || "Yükleme adresi alınamadı")
  }
  if (!data.path || !data.token || !data.bucket || !data.fileName) {
    throw new Error("Sunucudan geçersiz yükleme yanıtı")
  }

  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.storage
    .from(data.bucket)
    .uploadToSignedUrl(data.path, data.token, file, {
      contentType: resolveCorrespondenceMimeForUpload(file),
    })
  if (error) {
    throw new Error(`${file.name} yüklenemedi: ${error.message}`)
  }

  return { path: data.path, fileName: data.fileName }
}
