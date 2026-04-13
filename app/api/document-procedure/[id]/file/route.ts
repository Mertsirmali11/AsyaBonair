import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { effectiveEmployeeDepartman } from "@/lib/announcements-access"
import { canEditDocumentProcedure } from "@/lib/document-procedure-access"
import { DOCUMENT_PROCEDURE_SERIES_ID } from "@/lib/document-procedure-constants"
import { downloadPdfFromStorage } from "@/lib/supabase-storage"

export const runtime = "nodejs"

function asciiFallbackFileName(name: string): string {
  const t = name.trim() || "document"
  const ascii = t.replace(/[^\x20-\x7E]/g, "_").replace(/\s+/g, "_")
  return ascii.slice(0, 180) || "document.bin"
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const email = (session.user.email ?? "").trim()
  const calisan = email
    ? await prisma.calisan.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { departman: true },
      })
    : null
  const departman = effectiveEmployeeDepartman(
    calisan?.departman,
    session.user.departman
  )
  const editor = canEditDocumentProcedure(departman)

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const row = await prisma.documentProcedureVersion.findUnique({
    where: { id: numericId },
    select: {
      id: true,
      revision: true,
      seriesId: true,
      isCurrent: true,
      fileStoragePath: true,
      originalFileName: true,
      fileMimeType: true,
    },
  })

  if (!row || row.seriesId !== DOCUMENT_PROCEDURE_SERIES_ID) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (!row.isCurrent && !editor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (!row.fileStoragePath?.trim()) {
    return NextResponse.json(
      { error: "Bu sürüm için dosya kaydı yok (eski kayıt)." },
      { status: 404 }
    )
  }

  const buf = await downloadPdfFromStorage(row.fileStoragePath)
  if (!buf) {
    return NextResponse.json({ error: "Dosya depodan okunamadı." }, { status: 500 })
  }

  const download = req.nextUrl.searchParams.get("download") === "1"
  const name =
    row.originalFileName?.trim() ||
    `Document-Procedure-rev-${row.revision}.pdf`
  const ascii = asciiFallbackFileName(name)
  const utf8 = encodeURIComponent(name)
  const disposition = download
    ? `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`
    : `inline; filename="${ascii}"; filename*=UTF-8''${utf8}`

  const nameLower = name.toLowerCase()
  const mimeFromRow = row.fileMimeType?.trim() || ""
  const mime =
    mimeFromRow ||
    (nameLower.endsWith(".pdf") ? "application/pdf" : "application/octet-stream")

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=3600",
    },
  })
}
