import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { contentTypeFromFileName } from "@/lib/allowed-document-uploads"
import { downloadAircraftManualFile } from "@/lib/aircraft-manuals-storage"
import {
  DEPARTMENT_PERMISSION_KEYS,
  hasDepartmentPermission,
} from "@/lib/require-department-permission"

export const runtime = "nodejs"

function asciiFallbackFileName(name: string): string {
  const t = name.trim() || "document.pdf"
  const ascii = t.replace(/[^\x20-\x7E]/g, "_").replace(/\s+/g, "_")
  return ascii.slice(0, 180) || "document.pdf"
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (
      !(await hasDepartmentPermission(
        session.user?.departman,
        DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA
      ))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { docId } = await params
    const id = parseInt(docId, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid document id" }, { status: 400 })
    }

    const doc = await prisma.aircraftDocument.findUnique({
      where: { id },
      select: {
        fileName: true,
        storagePath: true,
      },
    })

    if (!doc?.storagePath?.trim()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const buffer = await downloadAircraftManualFile(doc.storagePath)
    if (!buffer) {
      return NextResponse.json(
        { error: "Dosya depoda bulunamadı." },
        { status: 404 }
      )
    }

    const displayName = (doc.fileName ?? "document").trim() || "document"
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
    console.error("GET aircraft document file:", detail)
    return NextResponse.json(
      { error: `Dosya sunulamadı: ${detail}` },
      { status: 500 }
    )
  }
}
