import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { contentTypeFromFileName } from "@/lib/allowed-document-uploads"
import { downloadPdfFromStorage } from "@/lib/supabase-storage"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!canAccessConfigurationsArea(session.user?.departman)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { path: pathArray } = await params
    const fileName = pathArray[pathArray.length - 1]
    const paperNo = pathArray[0]

    const storagePath = `${paperNo}/${fileName}`

    const fileBuffer = await downloadPdfFromStorage(storagePath)

    if (!fileBuffer) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      )
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": contentTypeFromFileName(fileName),
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (error) {
    console.error("Error serving file:", error)
    return NextResponse.json(
      { error: "Could not serve file" },
      { status: 500 }
    )
  }
}
