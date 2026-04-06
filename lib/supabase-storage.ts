import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  isAllowedCorrespondenceDocumentFile,
  resolveDocumentMimeForUpload,
} from "@/lib/allowed-document-uploads"

export function getStorageBucket(): string {
  return (
    process.env.SUPABASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ||
    "incoming-papers"
  )
}

/**
 * Profil fotoğrafları için bucket. Evrak bucket’ında “Allowed MIME types” sadece PDF vb. ise
 * Supabase’te image/* izinli yeni bucket açıp SUPABASE_AVATAR_BUCKET ile buraya bağlayın.
 */
export function getAvatarStorageBucket(): string {
  const raw =
    process.env.SUPABASE_AVATAR_BUCKET ||
    process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET
  const name = raw?.trim()
  return name && name.length > 0 ? name : getStorageBucket()
}

let supabaseAdminInstance: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdminInstance) return supabaseAdminInstance
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase environment variables are not set.")
  }
  supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return supabaseAdminInstance
}

export type UploadPdfToStorageResult =
  | { ok: true; path: string; fileName: string; publicUrl: string }
  | { ok: false; message: string }

export async function uploadPdfToStorage(
  file: File,
  folderPrefix: string,
  options?: { storageFileName?: string; upsert?: boolean }
): Promise<UploadPdfToStorageResult> {
  try {
    const sourceName = options?.storageFileName ?? file.name
    const sanitizedFileName = sourceName
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/\.\./g, "_")
      .replace(/\s+/g, "_")
    const storagePath = `${folderPrefix}/${sanitizedFileName}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const supabaseAdmin = getSupabaseAdmin()
    const upsert = options?.upsert ?? true
    const mime = resolveDocumentMimeForUpload(file)
    const doUpload = (contentType: string) =>
      supabaseAdmin.storage.from(getStorageBucket()).upload(storagePath, buffer, {
        contentType,
        upsert,
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
      const msg =
        typeof error.message === "string" && error.message.length > 0
          ? error.message
          : "Storage upload rejected"
      console.error("[uploadPdfToStorage]", storagePath, error)
      return { ok: false, message: msg }
    }
    const { data: urlData } = supabaseAdmin.storage
      .from(getStorageBucket())
      .getPublicUrl(storagePath)
    return {
      ok: true,
      path: storagePath,
      fileName: sanitizedFileName,
      publicUrl: urlData.publicUrl,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[uploadPdfToStorage] catch", e)
    return { ok: false, message }
  }
}

export async function downloadPdfFromStorage(
  storagePath: string
): Promise<Buffer | null> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin.storage
      .from(getStorageBucket())
      .download(storagePath)
    if (error) return null
    const arrayBuffer = await data.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

export async function deletePdfFromStorage(storagePath: string): Promise<boolean> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin.storage
      .from(getStorageBucket())
      .remove([storagePath])
    if (error) return false
    return true
  } catch {
    return false
  }
}

/** `calisan-avatars/...` yolları — yükleme hangi bucket’taysa silme de oradan */
export async function deleteCalisanAvatarFromStorage(
  storagePath: string
): Promise<boolean> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin.storage
      .from(getAvatarStorageBucket())
      .remove([storagePath])
    if (error) return false
    return true
  } catch {
    return false
  }
}

/** Proxy route / tarayıcı için — private bucket’ta da çalışır */
export async function downloadCalisanAvatarFromStorage(
  storagePath: string
): Promise<Buffer | null> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin.storage
      .from(getAvatarStorageBucket())
      .download(storagePath)
    if (error || !data) return null
    const arrayBuffer = await data.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

const HAZARD_MAX_BYTES = 50 * 1024 * 1024

export function classifyHazardFileKind(
  file: File
): "image" | "video" | "pdf" | "document" | null {
  const mime = (file.type || "").toLowerCase()
  const name = file.name.toLowerCase()
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf"
  if (isAllowedCorrespondenceDocumentFile(file)) return "document"
  return null
}

const DM_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024

/** Çalışan profil fotoğrafı — kullanıcı isteği: en fazla 21 MB */
export const CALISAN_AVATAR_MAX_BYTES = 21 * 1024 * 1024

export function isAllowedCalisanAvatarMime(mime: string): boolean {
  const m = (mime || "").toLowerCase()
  return (
    m === "image/jpeg" ||
    m === "image/jpg" ||
    m === "image/png" ||
    m === "image/gif" ||
    m === "image/webp"
  )
}

/**
 * Tarayıcı bazen `file.type` boş bırakır (özellikle Windows); uzantıdan tahmin eder.
 */
export function resolveCalisanAvatarMime(file: File): string | null {
  const raw = (file.type || "").trim().toLowerCase()
  if (raw && isAllowedCalisanAvatarMime(raw)) {
    return raw === "image/jpg" ? "image/jpeg" : raw
  }
  const name = file.name.toLowerCase()
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg"
  if (name.endsWith(".png")) return "image/png"
  if (name.endsWith(".gif")) return "image/gif"
  if (name.endsWith(".webp")) return "image/webp"
  return null
}

export type UploadCalisanAvatarResult =
  | { ok: true; path: string; publicUrl: string }
  | { ok: false; message: string }

export async function uploadCalisanAvatarToStorage(
  file: File,
  calisanId: number
): Promise<UploadCalisanAvatarResult> {
  try {
    if (file.size > CALISAN_AVATAR_MAX_BYTES) {
      return {
        ok: false,
        message: `File must be at most ${CALISAN_AVATAR_MAX_BYTES / (1024 * 1024)} MB.`,
      }
    }
    const mime = resolveCalisanAvatarMime(file)
    if (!mime) {
      return {
        ok: false,
        message:
          "Invalid image type. Choose JPEG, PNG, GIF, or WebP (if the browser omits the type, try a .jpg or .png file name).",
      }
    }

    const ext =
      mime === "image/png"
        ? "png"
        : mime === "image/gif"
          ? "gif"
          : mime === "image/webp"
            ? "webp"
            : "jpg"
    const uid =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const storagePath = `calisan-avatars/${calisanId}/${uid}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const supabaseAdmin = getSupabaseAdmin()
    const bucket = getAvatarStorageBucket()

    const doUpload = (contentType: string) =>
      supabaseAdmin.storage.from(bucket).upload(storagePath, buffer, {
        contentType,
        upsert: false,
      })

    let { error } = await doUpload(mime)

    if (
      error &&
      /mime type .+ is not supported/i.test(error.message || "")
    ) {
      const retry = await doUpload("application/octet-stream")
      if (!retry.error) {
        error = null
      } else {
        error = retry.error
      }
    }

    if (error) {
      const msg = error.message || String(error)
      if (/bucket not found|not found/i.test(msg)) {
        return {
          ok: false,
          message: `Supabase bucket not found: "${bucket}". Create it in the dashboard; for profile photos you can set a dedicated bucket via SUPABASE_AVATAR_BUCKET.`,
        }
      }
      if (/mime type .+ is not supported/i.test(msg)) {
        return {
          ok: false,
          message:
            `Bucket "${bucket}" does not allow this image type (${msg}). In Supabase → Storage → your bucket settings, add image/* to "Allowed MIME types" or remove the restriction. Alternatively, create a new bucket that allows image/* and set SUPABASE_AVATAR_BUCKET in .env.`,
        }
      }
      return { ok: false, message: msg }
    }
    const { data: urlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(storagePath)
    return {
      ok: true,
      path: storagePath,
      publicUrl: urlData.publicUrl,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/environment variables are not set|Supabase environment/i.test(msg)) {
      return {
        ok: false,
        message:
          "Server misconfiguration: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
      }
    }
    return { ok: false, message: msg || "Storage error" }
  }
}

function avatarExtFromMime(mime: string): string {
  if (mime === "image/png") return "png"
  if (mime === "image/gif") return "gif"
  if (mime === "image/webp") return "webp"
  return "jpg"
}

/** Pending self-service registration profile photo (`pending-worker-registrations/...`). */
export async function uploadPendingWorkerPhotoToStorage(
  file: File,
  registrationId: number
): Promise<UploadCalisanAvatarResult> {
  try {
    if (file.size > CALISAN_AVATAR_MAX_BYTES) {
      return {
        ok: false,
        message: `File must be at most ${CALISAN_AVATAR_MAX_BYTES / (1024 * 1024)} MB.`,
      }
    }
    const mime = resolveCalisanAvatarMime(file)
    if (!mime) {
      return {
        ok: false,
        message:
          "Invalid image type. Choose JPEG, PNG, GIF, or WebP (if the browser omits the type, try a .jpg or .png file name).",
      }
    }
    const ext = avatarExtFromMime(mime)
    const uid =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const storagePath = `pending-worker-registrations/${registrationId}/${uid}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const supabaseAdmin = getSupabaseAdmin()
    const bucket = getAvatarStorageBucket()

    const doUpload = (contentType: string) =>
      supabaseAdmin.storage.from(bucket).upload(storagePath, buffer, {
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
      return { ok: false, message: error.message || String(error) }
    }
    const { data: urlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(storagePath)
    return { ok: true, path: storagePath, publicUrl: urlData.publicUrl }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg || "Storage error" }
  }
}

/** Copy approved registration photo into `calisan-avatars/{calisanId}/...`. */
export async function uploadCalisanAvatarFromBuffer(
  buffer: Buffer,
  calisanId: number,
  mime: string
): Promise<UploadCalisanAvatarResult> {
  try {
    if (buffer.length > CALISAN_AVATAR_MAX_BYTES) {
      return {
        ok: false,
        message: `File must be at most ${CALISAN_AVATAR_MAX_BYTES / (1024 * 1024)} MB.`,
      }
    }
    const ext = avatarExtFromMime(mime)
    const uid =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const storagePath = `calisan-avatars/${calisanId}/${uid}.${ext}`
    const supabaseAdmin = getSupabaseAdmin()
    const bucket = getAvatarStorageBucket()

    const doUpload = (contentType: string) =>
      supabaseAdmin.storage.from(bucket).upload(storagePath, buffer, {
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
      return { ok: false, message: error.message || String(error) }
    }
    const { data: urlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(storagePath)
    return { ok: true, path: storagePath, publicUrl: urlData.publicUrl }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg || "Storage error" }
  }
}

/** Mesaj eki için izin verilen MIME türleri */
export function isAllowedDmAttachmentMime(mime: string): boolean {
  const m = mime.toLowerCase()
  if (m.startsWith("image/")) return true
  if (m === "application/pdf") return true
  if (m === "text/plain") return true
  if (m === "application/zip" || m === "application/x-zip-compressed") return true
  if (m.startsWith("application/vnd.openxmlformats-officedocument")) return true
  if (m === "application/msword") return true
  if (m === "application/vnd.ms-excel") return true
  return false
}

export async function uploadDmAttachmentToStorage(
  file: File,
  conversationId: number,
  calisanId: number
): Promise<{
  path: string
  fileName: string
  publicUrl: string
  mimeType: string
  size: number
} | null> {
  try {
    if (file.size > DM_ATTACHMENT_MAX_BYTES) return null
    const mime = file.type || "application/octet-stream"
    if (!isAllowedDmAttachmentMime(mime)) return null

    const safe =
      file.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/\.\./g, "_")
        .replace(/\s+/g, "_") || "file"
    const uid =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const storagePath = `dm/${conversationId}/${calisanId}/${uid}_${safe}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin.storage
      .from(getStorageBucket())
      .upload(storagePath, buffer, {
        contentType: mime,
        upsert: false,
      })
    if (error) throw error
    const { data: urlData } = supabaseAdmin.storage
      .from(getStorageBucket())
      .getPublicUrl(storagePath)
    return {
      path: storagePath,
      fileName: file.name || safe,
      publicUrl: urlData.publicUrl,
      mimeType: mime,
      size: file.size,
    }
  } catch {
    return null
  }
}

export async function uploadHazardFileToStorage(
  file: File,
  hazardReportId: number
): Promise<{ path: string; fileName: string; publicUrl: string } | null> {
  try {
    if (file.size > HAZARD_MAX_BYTES) return null
    const kind = classifyHazardFileKind(file)
    if (!kind) return null

    const safe =
      file.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/\.\./g, "_")
        .replace(/\s+/g, "_") || "file"
    const storagePath = `hazard-reports/${hazardReportId}/${Date.now()}_${safe}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const supabaseAdmin = getSupabaseAdmin()
    const contentType =
      kind === "pdf" || kind === "document"
        ? resolveDocumentMimeForUpload(file)
        : file.type?.trim() || "application/octet-stream"
    const { error } = await supabaseAdmin.storage
      .from(getStorageBucket())
      .upload(storagePath, buffer, {
        contentType,
        upsert: false,
      })
    if (error) throw error
    const { data: urlData } = supabaseAdmin.storage
      .from(getStorageBucket())
      .getPublicUrl(storagePath)
    return {
      path: storagePath,
      fileName: file.name,
      publicUrl: urlData.publicUrl,
    }
  } catch {
    return null
  }
}