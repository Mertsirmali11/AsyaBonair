import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { contentTypeFromFileName } from "@/lib/allowed-document-uploads"
import { isAdminDepartment } from "@/lib/department-access"
import { downloadCompanyManualFile } from "@/lib/company-manuals-storage"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
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
        isCurrent: true,
      },
    })

    if (!manual?.fileStoragePath) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (!manual.isCurrent && !isAdminDepartment(session.user.departman)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const buffer = await downloadCompanyManualFile(manual.fileStoragePath)
    if (!buffer) {
      return NextResponse.json(
        { error: "Dosya depoda bulunamadı." },
        { status: 404 }
      )
    }

    const safeName = (manual.fileName ?? "manual").replace(/[\r\n"]/g, "_")

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentTypeFromFileName(safeName),
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (e) {
    console.error("GET /api/manuals/[id]/file:", e)
    return NextResponse.json({ error: "Dosya sunulamadı." }, { status: 500 })
  }
}
