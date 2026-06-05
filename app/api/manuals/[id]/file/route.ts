import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { contentTypeFromFileName } from "@/lib/allowed-document-uploads"
import { downloadCompanyManualFile } from "@/lib/company-manuals-storage"

export const runtime = "nodejs"

function asciiFallbackFileName(name: string): string {
  const t = name.trim() || "manual.pdf"
  const ascii = t.replace(/[^\x20-\x7E]/g, "_").replace(/\s+/g, "_")
  return ascii.slice(0, 180) || "manual.pdf"
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const numericId = Number.parseInt(id, 10)
    if (Number.isNaN(numericId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const manual = await prisma.companyManual.findUnique({
      where: { id: numericId },
      select: {
        fileStoragePath: true,
        fileName: true,
      },
    })

    if (!manual?.fileStoragePath?.trim()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const buffer = await downloadCompanyManualFile(manual.fileStoragePath)
    if (!buffer) {
      return NextResponse.json(
        { error: "Dosya depoda bulunamadı." },
        { status: 404 }
      )
    }

    const displayName = (manual.fileName ?? "manual").trim() || "manual"
    const ascii = asciiFallbackFileName(displayName)
    const utf8 = encodeURIComponent(displayName)
    const download = req.nextUrl.searchParams.get("download") === "1"
    const disposition = download
      ? `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`
      : `inline; filename="${ascii}"; filename*=UTF-8''${utf8}`

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentTypeFromFileName(displayName),
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=3600",
        "X-Frame-Options": "SAMEORIGIN",
      },
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error("GET /api/manuals/[id]/file:", detail)
    return NextResponse.json(
      { error: `Dosya sunulamadı: ${detail}` },
      { status: 500 }
    )
  }
}
