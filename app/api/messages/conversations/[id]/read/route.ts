import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { broadcastDmInboxBoth } from "@/lib/dm-broadcast"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const calisanId = Number.parseInt(session.user.id, 10)
  if (Number.isNaN(calisanId)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 })
  }

  const { id: raw } = await params
  const conversationId = Number.parseInt(raw, 10)
  if (Number.isNaN(conversationId)) {
    return NextResponse.json({ error: "Invalid conversation" }, { status: 400 })
  }

  const conv = await prisma.dmConversation.findUnique({
    where: { id: conversationId },
    select: { lowerUserId: true, higherUserId: true },
  })
  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (conv.lowerUserId !== calisanId && conv.higherUserId !== calisanId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const agg = await prisma.dmMessage.aggregate({
    where: { conversationId },
    _max: { id: true },
  })
  const maxId = agg._max.id
  if (maxId == null) {
    return NextResponse.json({ ok: true, lastReadMessageId: null })
  }

  const existing = await prisma.dmReadState.findUnique({
    where: {
      conversationId_calisanId: { conversationId, calisanId },
    },
    select: { lastReadMessageId: true },
  })
  if (existing?.lastReadMessageId === maxId) {
    return NextResponse.json({ ok: true, lastReadMessageId: maxId })
  }

  await prisma.dmReadState.upsert({
    where: {
      conversationId_calisanId: { conversationId, calisanId },
    },
    create: {
      conversationId,
      calisanId,
      lastReadMessageId: maxId,
    },
    update: {
      lastReadMessageId: maxId,
    },
  })

  void broadcastDmInboxBoth(
    conversationId,
    conv.lowerUserId,
    conv.higherUserId
  )

  return NextResponse.json({ ok: true, lastReadMessageId: maxId })
}
