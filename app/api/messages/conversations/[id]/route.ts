import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { broadcastDmInboxBoth } from "@/lib/dm-broadcast"

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
      select: { id: true, lowerUserId: true, higherUserId: true },
    })
    if (!conv) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (conv.lowerUserId !== calisanId && conv.higherUserId !== calisanId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.dmConversation.delete({ where: { id: conversationId } })

    await broadcastDmInboxBoth(
      conversationId,
      conv.lowerUserId,
      conv.higherUserId
    )

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
