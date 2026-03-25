import { prisma } from "@/lib/prisma-server"
import {
  classifyHazardFileKind,
  uploadHazardFileToStorage,
} from "@/lib/supabase-storage"

export async function persistHazardFilesFromUploads(
  reportId: number,
  files: File[]
): Promise<{ ok: number; failed: number }> {
  let ok = 0
  let failed = 0
  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) continue
    const uploaded = await uploadHazardFileToStorage(file, reportId)
    if (!uploaded) {
      failed++
      continue
    }
    const kind = classifyHazardFileKind(file.type)
    if (!kind) {
      failed++
      continue
    }
    await prisma.hazardAttachment.create({
      data: {
        hazardReportId: reportId,
        storagePath: uploaded.path,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        kind,
        publicUrl: uploaded.publicUrl,
      },
    })
    ok++
  }
  return { ok, failed }
}
