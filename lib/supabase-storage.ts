import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

export function getStorageBucket(): string {
  return (
    process.env.SUPABASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ||
    "incoming-papers"
  )
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

export async function uploadPdfToStorage(
  file: File,
  paperNo: string
): Promise<{ path: string; fileName: string; publicUrl: string } | null> {
  try {
    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/\.\./g, "_")
      .replace(/\s+/g, "_")
    const storagePath = `${paperNo}/${sanitizedFileName}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin.storage
      .from(getStorageBucket())
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      })
    if (error) throw error
    const { data: urlData } = supabaseAdmin.storage
      .from(getStorageBucket())
      .getPublicUrl(storagePath)
    return {
      path: storagePath,
      fileName: sanitizedFileName,
      publicUrl: urlData.publicUrl,
    }
  } catch {
    return null
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

const HAZARD_MAX_BYTES = 50 * 1024 * 1024

export function classifyHazardFileKind(
  mime: string
): "image" | "video" | "pdf" | null {
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  if (mime === "application/pdf") return "pdf"
  return null
}

export async function uploadHazardFileToStorage(
  file: File,
  hazardReportId: number
): Promise<{ path: string; fileName: string; publicUrl: string } | null> {
  try {
    if (file.size > HAZARD_MAX_BYTES) return null
    const kind = classifyHazardFileKind(file.type)
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
    const { error } = await supabaseAdmin.storage
      .from(getStorageBucket())
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
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