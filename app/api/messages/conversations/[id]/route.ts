import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { isDmMember } from "@/lib/dm"
import { broadcastDmInboxMany } from "@/lib/dm-broadcast"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const calisanId = Number.parseInt(session.user.id, 10)
    if (Number.isNaN(calisanId) || calisanId < 1) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 })
    }

    const { id: raw } = await params
    const conversationId = Number.parseInt(raw, 10)
    if (Number.isNaN(conversationId)) {
      return NextResponse.json({ error: "Invalid conversation" }, { status: 400 })
    }

    const conv = await prisma.dmConversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        isGroup: true,
        lowerUserId: true,
        higherUserId: true,
        members: { select: { calisanId: true } },
      },
    })
    if (!conv) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (!isDmMember(
      {
        isGroup: conv.isGroup,
        lowerUserId: conv.lowerUserId,
        higherUserId: conv.higherUserId,
        members: conv.members,
      },
      calisanId
    )) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const targets = conv.isGroup
      ? conv.members.map((m) => m.calisanId)
      : [conv.lowerUserId!, conv.higherUserId!]

    await prisma.dmConversation.delete({ where: { id: conversationId } })

    void broadcastDmInboxMany(conversationId, targets)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[DELETE /api/messages/conversations/[id]]", e)
    const message =
      process.env.NODE_ENV === "development" && e instanceof Error
        ? e.message
        : "Sunucu hatası"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
