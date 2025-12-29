import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

// Storage bucket adı
export const STORAGE_BUCKET = "incoming-papers"

// Lazy initialization - Supabase client'ı sadece kullanıldığında oluştur
let supabaseAdminInstance: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase environment variables are not set. Please configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
  }

  supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return supabaseAdminInstance
}

/**
 * PDF dosyasını Supabase Storage'a yükle
 * @param file PDF dosyası
 * @param paperNo Paper numarası (örn: BON-IP-001)
 * @returns Public URL veya null
 */
export async function uploadPdfToStorage(
  file: File,
  paperNo: string
): Promise<{ path: string; fileName: string; publicUrl: string } | null> {
  try {
    // Dosya adını temizle
    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/\.\./g, "_")
      .replace(/\s+/g, "_")

    // Storage path: incoming-papers/BON-IP-001/filename.pdf
    const storagePath = `${paperNo}/${sanitizedFileName}`

    // Dosyayı ArrayBuffer'a çevir
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Supabase Storage'a yükle
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false, // Aynı dosya varsa hata ver
      })

    if (error) {
      console.error("Supabase Storage upload error:", error)
      throw error
    }

    // Public URL al
    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath)

    return {
      path: storagePath,
      fileName: sanitizedFileName,
      publicUrl: urlData.publicUrl,
    }
  } catch (error: any) {
    console.error("Error uploading to Supabase Storage:", error)
    throw error
  }
}

/**
 * Supabase Storage'dan dosya indir
 * @param storagePath Storage path (örn: BON-IP-001/filename.pdf)
 * @returns File buffer veya null
 */
export async function downloadPdfFromStorage(
  storagePath: string
): Promise<Buffer | null> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .download(storagePath)

    if (error) {
      console.error("Supabase Storage download error:", error)
      return null
    }

    // Blob'u Buffer'a çevir
    const arrayBuffer = await data.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error: any) {
    console.error("Error downloading from Supabase Storage:", error)
    return null
  }
}

/**
 * Supabase Storage'dan dosya sil
 * @param storagePath Storage path (örn: BON-IP-001/filename.pdf)
 */
export async function deletePdfFromStorage(storagePath: string): Promise<boolean> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath])

    if (error) {
      console.error("Supabase Storage delete error:", error)
      return false
    }

    return true
  } catch (error: any) {
    console.error("Error deleting from Supabase Storage:", error)
    return false
  }
}
