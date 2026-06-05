import { randomBytes } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveDocumentMimeForUpload } from "@/lib/allowed-document-uploads"
import { getStorageBucket } from "@/lib/supabase-storage"

/** Ayrı bucket adı verilmişse kullanılır; yoksa genel `getStorageBucket()` + `company-manuals/` öneki */
function dedicatedCompanyManualsBucketName(): string {
  return (
    process.env.SUPABASE_COMPANY_MANUALS_BUCKET ||
    process.env.NEXT_PUBLIC_SUPABASE_COMPANY_MANUALS_BUCKET ||
    ""
  )
    .trim()
}

export function getCompanyManualsBucket(): string {
  const dedicated = dedicatedCompanyManualsBucketName()
  if (dedicated) return dedicated
  return getStorageBucket()
}

/** Paylaşılan bucket kullanılırken nesne yolu çakışmasını önlemek için klasör öneki */
export function companyManualsObjectPrefix(): string {
  return dedicatedCompanyManualsBucketName() ? "" : "company-manuals/"
}

let supabaseAdminInstance: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdminInstance) return supabaseAdminInstance
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase environment variables are not set.")
  }
  supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return supabaseAdminInstance
}

function sanitizeFileSegment(name: string): string {
  const s = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/\s+/g, "_")
  return (s || "document").slice(0, 120)
}

const MAX_BYTES = 32 * 1024 * 1024

export type UploadCompanyManualResult =
  | { ok: true; storagePath: string; fileName: string }
  | { ok: false; message: string }

/**
 * Şirket manueli orijinal dosyasını bucket’a yükler.
 * `seriesId` aynı mantıksal kitabın tüm revizyonlarında ortaktır.
 */
async function tryUploadToBucket(
  bucket: string,
  storagePath: string,
  buffer: Buffer,
  file: File
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = getSupabaseAdmin()
  const mime = resolveDocumentMimeForUpload(file)
  const doUpload = (contentType: string) =>
    supabase.storage.from(bucket).upload(storagePath, buffer, {
      contentType,
      upsert: false,
    })
  let { error } = await doUpload(mime)
  if (
    error &&
    /mime type .+ is not supported/i.test(error.message || "")
  ) {
    const retry = await doUpload("application/octet-stream")
    if (!retry.error) error = null
    else error = retry.error
  }
  if (error) {
    console.error("[company-manuals-storage] upload:", bucket, storagePath, error)
    return {
      ok: false,
      message: error.message || "Depoya yüklenemedi.",
    }
  }
  return { ok: true }
}

function buildStoragePath(
  prefix: string,
  seriesId: string,
  revision: number,
  slug: string,
  file: File
): string {
  const safe = sanitizeFileSegment(file.name)
  const slugPart = sanitizeFileSegment(slug).slice(0, 48)
  const rand = randomBytes(5).toString("hex")
  return `${prefix}${seriesId}/r${revision}_${Date.now()}_${rand}_${slugPart}_${safe}`
    .replace(/\/+/g, "/")
    .replace(/^\//, "")
    .slice(0, 450)
}

export async function uploadCompanyManualFile(
  buffer: Buffer,
  seriesId: string,
  slug: string,
  revision: number,
  file: File
): Promise<UploadCompanyManualResult> {
  try {
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
      return { ok: false, message: "Dosya boş veya boyut sınırını aşıyor." }
    }

    const primaryBucket = getCompanyManualsBucket()
    const primaryPrefix = companyManualsObjectPrefix()
    let storagePath = buildStoragePath(
      primaryPrefix,
      seriesId,
      revision,
      slug,
      file
    )

    let attempt = await tryUploadToBucket(
      primaryBucket,
      storagePath,
      buffer,
      file
    )
    if (attempt.ok) {
      return { ok: true, storagePath, fileName: file.name }
    }

    const dedicated = dedicatedCompanyManualsBucketName()
    const looksLikeMissingBucket =
      /not found|does not exist|No such bucket|Bucket not found/i.test(
        attempt.message
      )
    if (dedicated && primaryBucket === dedicated && looksLikeMissingBucket) {
      const fallbackBucket = getStorageBucket()
      if (fallbackBucket !== primaryBucket) {
        const fbPrefix = "company-manuals/"
        storagePath = buildStoragePath(
          fbPrefix,
          seriesId,
          revision,
          slug,
          file
        )
        attempt = await tryUploadToBucket(
          fallbackBucket,
          storagePath,
          buffer,
          file
        )
        if (attempt.ok) {
          console.warn(
            `[company-manuals-storage] Dedicated bucket "${dedicated}" unavailable; used "${fallbackBucket}" + ${fbPrefix}`
          )
          return { ok: true, storagePath, fileName: file.name }
        }
      }
    }

    const hint = /not found|does not exist|No such bucket|Bucket not found/i.test(
      attempt.message
    )
      ? " Bucket’ı Supabase’te oluşturun veya .env’de SUPABASE_COMPANY_MANUALS_BUCKET tanımlıysa kaldırıp varsayılan SUPABASE_STORAGE_BUCKET ile deneyin."
      : ""
    return { ok: false, message: `${attempt.message}${hint}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Depoya yüklenemedi."
    console.error("[company-manuals-storage] upload exception:", e)
    return { ok: false, message: msg }
  }
}

function companyManualsDownloadBuckets(): string[] {
  const primary = getCompanyManualsBucket()
  const fb = getStorageBucket()
  if (fb === primary) return [primary]
  return [primary, fb]
}

const COMPANY_MANUALS_PREFIX = "company-manuals/"

/** Eski kayıtlar / bucket fallback sonrası yol öneki farklı olabilir. */
function companyManualDownloadPathCandidates(storagePath: string): string[] {
  const normalized = storagePath.trim().replace(/^\/+/, "")
  if (!normalized) return []
  const out = new Set<string>([normalized])
  if (normalized.startsWith(COMPANY_MANUALS_PREFIX)) {
    out.add(normalized.slice(COMPANY_MANUALS_PREFIX.length))
  } else {
    out.add(`${COMPANY_MANUALS_PREFIX}${normalized}`)
  }
  return [...out]
}

export async function downloadCompanyManualFile(
  storagePath: string
): Promise<Buffer | null> {
  const paths = companyManualDownloadPathCandidates(storagePath)
  if (paths.length === 0) return null
  try {
    const supabase = getSupabaseAdmin()
    for (const bucket of companyManualsDownloadBuckets()) {
      for (const path of paths) {
        const { data, error } = await supabase.storage.from(bucket).download(path)
        if (!error && data) {
          return Buffer.from(await data.arrayBuffer())
        }
        if (error) {
          console.warn(
            "[company-manuals-storage] download miss:",
            bucket,
            path,
            error.message
          )
        }
      }
    }
    return null
  } catch (e) {
    console.error("[company-manuals-storage] download exception:", e)
    return null
  }
}

export async function deleteCompanyManualFile(
  storagePath: string | null | undefined
): Promise<void> {
  if (!storagePath?.trim()) return
  try {
    const supabase = getSupabaseAdmin()
    for (const bucket of companyManualsDownloadBuckets()) {
      await supabase.storage.from(bucket).remove([storagePath])
    }
  } catch {
    /* best-effort */
  }
}
