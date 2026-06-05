import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  isAllowedCorrespondenceDocumentFile,
  resolveDocumentMimeForUpload,
} from "@/lib/allowed-document-uploads"
import { getStorageBucket } from "@/lib/supabase-storage"

const FALLBACK_PREFIX = "aircraft-documents/"

function dedicatedAircraftBucketName(): string {
  return (
    process.env.SUPABASE_AIRCRAFT_MANUALS_BUCKET ||
    process.env.NEXT_PUBLIC_SUPABASE_AIRCRAFT_MANUALS_BUCKET ||
    ""
  )
    .trim()
}

export function getAircraftManualsBucket(): string {
  const dedicated = dedicatedAircraftBucketName()
  if (dedicated) return dedicated
  return "Aircraft-Manuals"
}

function aircraftObjectPrefix(bucket: string): string {
  const dedicated = dedicatedAircraftBucketName()
  if (dedicated && bucket === dedicated) return ""
  if (bucket === getStorageBucket()) return FALLBACK_PREFIX
  return ""
}

function aircraftDownloadBuckets(): string[] {
  const primary = getAircraftManualsBucket()
  const fb = getStorageBucket()
  if (fb === primary) return [primary]
  return [primary, fb]
}

function aircraftDownloadPathCandidates(storagePath: string): string[] {
  const normalized = storagePath.trim().replace(/^\/+/, "")
  if (!normalized) return []
  const out = new Set<string>([normalized])
  if (normalized.startsWith(FALLBACK_PREFIX)) {
    out.add(normalized.slice(FALLBACK_PREFIX.length))
  } else {
    out.add(`${FALLBACK_PREFIX}${normalized}`)
  }
  return [...out]
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

export function sanitizeRegisterSegment(register: string): string {
  const s = register.trim().replace(/[^a-zA-Z0-9._-]/g, "_")
  return s || "unknown"
}

const MAX_PDF_BYTES = 50 * 1024 * 1024

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
    console.error("[aircraft-manuals-storage] upload:", bucket, storagePath, error)
    return { ok: false, message: error.message || "Depoya yüklenemedi." }
  }
  return { ok: true }
}

export async function uploadAircraftManualPdf(
  file: File,
  register: string,
  category: "certificate" | "manual"
): Promise<{ path: string; fileName: string } | null> {
  try {
    if (file.size > MAX_PDF_BYTES) return null
    if (!isAllowedCorrespondenceDocumentFile(file)) return null

    const reg = sanitizeRegisterSegment(register)
    const safe =
      file.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/\.\./g, "_")
        .replace(/\s+/g, "_") || "document.pdf"
    const relPath = `${reg}/${category}/${Date.now()}_${safe}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const primaryBucket = getAircraftManualsBucket()
    let storagePath = `${aircraftObjectPrefix(primaryBucket)}${relPath}`

    let attempt = await tryUploadToBucket(
      primaryBucket,
      storagePath,
      buffer,
      file
    )
    if (attempt.ok) {
      return { path: storagePath, fileName: file.name }
    }

    const looksLikeMissingBucket =
      /not found|does not exist|No such bucket|Bucket not found/i.test(
        attempt.message
      )
    const dedicated = dedicatedAircraftBucketName()
    if (looksLikeMissingBucket) {
      const fallbackBucket = getStorageBucket()
      if (fallbackBucket !== primaryBucket || dedicated) {
        const fbBucket = getStorageBucket()
        storagePath = `${FALLBACK_PREFIX}${relPath}`
        attempt = await tryUploadToBucket(
          fbBucket,
          storagePath,
          buffer,
          file
        )
        if (attempt.ok) {
          console.warn(
            `[aircraft-manuals-storage] Used fallback bucket "${fbBucket}" for aircraft document`
          )
          return { path: storagePath, fileName: file.name }
        }
      }
    }

    return null
  } catch (e) {
    console.error("[aircraft-manuals-storage] upload exception:", e)
    return null
  }
}

export async function downloadAircraftManualFile(
  storagePath: string
): Promise<Buffer | null> {
  const paths = aircraftDownloadPathCandidates(storagePath)
  if (paths.length === 0) return null
  try {
    const supabase = getSupabaseAdmin()
    for (const bucket of aircraftDownloadBuckets()) {
      for (const path of paths) {
        const { data, error } = await supabase.storage.from(bucket).download(path)
        if (!error && data) {
          return Buffer.from(await data.arrayBuffer())
        }
        if (error) {
          console.warn(
            "[aircraft-manuals-storage] download miss:",
            bucket,
            path,
            error.message
          )
        }
      }
    }
    return null
  } catch (e) {
    console.error("[aircraft-manuals-storage] download exception:", e)
    return null
  }
}

export async function deleteAircraftManualFile(
  storagePath: string
): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin()
    const paths = aircraftDownloadPathCandidates(storagePath)
    let ok = false
    for (const bucket of aircraftDownloadBuckets()) {
      for (const path of paths) {
        const { error } = await supabase.storage.from(bucket).remove([path])
        if (!error) ok = true
      }
    }
    return ok
  } catch {
    return false
  }
}
