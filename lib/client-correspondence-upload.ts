"use client"

import { createClient } from "@supabase/supabase-js"
import { resolveCorrespondenceMimeForUpload } from "@/lib/allowed-document-uploads"

export type PendingUploadRef = { path: string; fileName: string }

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

/**
 * Ekleri doğrudan Supabase Storage'a yükler (Vercel fonksiyon gövde sınırını
 * by-pass eder). Önce sunucudan imzalı yükleme URL'leri istenir, sonra her
 * dosya tarayıcıdan doğrudan Supabase'e PUT edilir.
 */
export async function uploadCorrespondenceFilesDirect(
  files: File[]
): Promise<PendingUploadRef[]> {
  if (files.length === 0) return []

  const res = await fetch("/api/correspondence-uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: files.map((f) => ({ name: f.name, size: f.size })),
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    bucket?: string
    uploads?: { originalName: string; fileName: string; path: string; signedUrl: string; token: string }[]
  }
  if (!res.ok) {
    throw new Error(data.error || "Yükleme adresi alınamadı")
  }
  const uploads = data.uploads ?? []
  const bucket = data.bucket
  if (!bucket) {
    throw new Error("Sunucu depo (bucket) bilgisini döndürmedi")
  }

  const supabase = getSupabaseBrowserClient()
  const results: PendingUploadRef[] = []
  for (let i = 0; i < files.length; i++) {
    const u = uploads[i]
    if (!u) throw new Error(`${files[i].name} için yükleme adresi alınamadı`)
    const { error } = await supabase.storage
      .from(bucket)
      .uploadToSignedUrl(u.path, u.token, files[i], {
        contentType: resolveCorrespondenceMimeForUpload(files[i]),
      })
    if (error) {
      throw new Error(`${files[i].name} yüklenemedi: ${error.message}`)
    }
    results.push({ path: u.path, fileName: u.fileName })
  }
  return results
}
