import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

export const STORAGE_BUCKET = "incoming-papers"

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
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      })
    if (error) throw error
    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
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
      .from(STORAGE_BUCKET)
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
      .from(STORAGE_BUCKET)
      .remove([storagePath])
    if (error) return false
    return true
  } catch {
    return false
  }
}