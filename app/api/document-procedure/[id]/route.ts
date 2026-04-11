import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { effectiveEmployeeDepartman } from "@/lib/announcements-access"
import { canEditDocumentProcedure } from "@/lib/document-procedure-access"
import { DOCUMENT_PROCEDURE_SERIES_ID } from "@/lib/document-procedure-constants"

export async function GET(
  _request: Request,
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
      title: true,
      contentText: true,
      isCurrent: true,
      seriesId: true,
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

  return NextResponse.json({
    version: {
      id: row.id,
      title: row.title,
      contentText: row.contentText,
      hasFile: Boolean(row.fileStoragePath?.trim()),
      originalFileName: row.originalFileName,
      fileMimeType: row.fileMimeType,
    },
  })
}
