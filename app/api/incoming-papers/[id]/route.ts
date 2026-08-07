import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import {
  getIncomingAttachmentsFromRow,
  type IncomingStoredAttachment,
} from "@/lib/incoming-correspondence-attachments"
import {
  deletePdfFromStorage,
  moveInStorage,
} from "@/lib/supabase-storage"

async function gate() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccessConfigurationsArea(session.user?.departman)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await gate()
  if (denied) return denied

  const { id: idParam } = await params
  const id = Number.parseInt(idParam, 10)
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const existing = await prisma.incomingPaper.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (!existing.paperNo) {
    return NextResponse.json({ error: "Record has no paper number" }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as {
    from?: string
    subject?: string
    date?: string
    content?: string
    attachments?: { path: string; fileName: string }[]
  } | null
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const from = String(body.from ?? "").trim()
  const subject = String(body.subject ?? "").trim()
  const dateStr = String(body.date ?? "").trim()
  const content = String(body.content ?? "")
  const pendingAttachments = Array.isArray(body.attachments)
    ? body.attachments.filter(
        (a): a is { path: string; fileName: string } =>
          !!a && typeof a.path === "string" && typeof a.fileName === "string"
      )
    : []

  if (!from || !subject || !dateStr) {
    return NextResponse.json(
      { error: "From, Subject, and Date are required" },
      { status: 400 }
    )
  }

  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
  }

  let pdfPath: string | null = existing.pdfPath
  let pdfFileName: string | null = existing.pdfFileName
  let pdfAttachments: IncomingStoredAttachment[] | undefined = undefined

  if (pendingAttachments.length > 0) {
    const previous = getIncomingAttachmentsFromRow(existing)
    for (const a of previous) {
      await deletePdfFromStorage(a.path)
    }

    const moved: IncomingStoredAttachment[] = []
    for (const att of pendingAttachments) {
      const target = `${existing.paperNo}/${att.fileName}`
      const moveResult = await moveInStorage(att.path, target)
      if (!moveResult.ok) {
        for (const m of moved) {
          await deletePdfFromStorage(m.path)
        }
        return NextResponse.json(
          {
            error: `Dosya taşınamadı (${att.fileName}): ${moveResult.message}`,
          },
          { status: 500 }
        )
      }
      moved.push({ path: target, fileName: att.fileName })
    }
    pdfAttachments = moved
    pdfPath = moved[0]?.path ?? null
    pdfFileName = moved[0]?.fileName ?? null
  }

  try {
    const paper = await prisma.incomingPaper.update({
      where: { id },
      data: {
        from,
        subject,
        date,
        content: content.trim() || null,
        pdfPath,
        pdfFileName,
        ...(pdfAttachments !== undefined
          ? {
              pdfAttachments:
                pdfAttachments.length > 0
                  ? (pdfAttachments as Prisma.InputJsonValue)
                  : Prisma.DbNull,
            }
          : {}),
      },
      include: {
        creator: {
          select: {
            id: true,
            isim: true,
            soyisim: true,
            email: true,
            departman: true,
          },
        },
      },
    })

    return NextResponse.json(paper)
  } catch (e) {
    console.error("PATCH incoming paper:", e)
    return NextResponse.json(
      { error: "Could not update correspondence" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await gate()
  if (denied) return denied

  const { id: idParam } = await params
  const id = Number.parseInt(idParam, 10)
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const existing = await prisma.incomingPaper.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const toRemove = getIncomingAttachmentsFromRow(existing)
  for (const a of toRemove) {
    await deletePdfFromStorage(a.path)
  }

  try {
    await prisma.incomingPaper.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("DELETE incoming paper:", e)
    return NextResponse.json(
      { error: "Could not delete correspondence" },
      { status: 500 }
    )
  }
}
