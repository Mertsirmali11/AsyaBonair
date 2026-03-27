import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { assertCanManageAnnouncements } from "@/lib/announcements-access"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertCanManageAnnouncements()
  if (!gate.ok) return gate.response

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const raw = body as { title?: unknown; content?: unknown }
  const title =
    typeof raw.title === "string" ? raw.title.trim() : ""
  const content =
    typeof raw.content === "string" ? raw.content.trim() : ""

  if (!title || !content) {
    return NextResponse.json(
      { error: "Title and content are required" },
      { status: 400 }
    )
  }

  try {
    const updated = await prisma.announcement.update({
      where: { id: numericId },
      data: { title, content },
      include: {
        creator: { select: { isim: true, soyisim: true, departman: true } },
      },
    })
    return NextResponse.json(updated)
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === "P2025") {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }
    console.error("PATCH announcement:", e)
    return NextResponse.json(
      { error: "Could not update announcement" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertCanManageAnnouncements()
  if (!gate.ok) return gate.response

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  try {
    await prisma.announcement.delete({
      where: { id: numericId },
    })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === "P2025") {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }
    console.error("DELETE announcement:", e)
    return NextResponse.json({ error: "Could not delete announcement" }, { status: 500 })
  }
}
