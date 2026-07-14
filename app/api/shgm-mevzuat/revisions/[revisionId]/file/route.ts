import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { downloadPdfFromStorage } from "@/lib/supabase-storage"

export const runtime = "nodejs"

function asciiFallbackFileName(name: string): string {
  const t = name.trim() || "document"
  const ascii = t.replace(/[^\x20-\x7E]/g, "_").replace(/\s+/g, "_")
  return ascii.slice(0, 180) || "document.pdf"
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ revisionId: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { revisionId } = await params
  const numericId = Number.parseInt(revisionId, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const revision = await prisma.shgmRegulationRevision.findUnique({
    where: { id: numericId },
    select: {
      pdfStoragePath: true,
      pdfFileName: true,
      regulation: { select: { title: true } },
    },
  })

  if (!revision?.pdfStoragePath) {
    return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 404 })
  }

  const buf = await downloadPdfFromStorage(revision.pdfStoragePath)
  if (!buf) {
    return NextResponse.json({ error: "Dosya depodan okunamadı." }, { status: 500 })
  }

  const download = req.nextUrl.searchParams.get("download") === "1"
  const name = revision.pdfFileName?.trim() || `${revision.regulation.title}.pdf`
  const ascii = asciiFallbackFileName(name)
  const utf8 = encodeURIComponent(name)
  const disposition = download
    ? `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`
    : `inline; filename="${ascii}"; filename*=UTF-8''${utf8}`

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=3600",
    },
  })
}
