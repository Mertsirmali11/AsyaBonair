import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { calisanAvatarPublicUrl } from "@/lib/calisan-avatar"
import { prisma } from "@/lib/prisma-server"
import { dmParticipantPair, otherParticipantId } from "@/lib/dm"

async function requireCalisanId() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const id = Number.parseInt(session.user.id, 10)
  if (Number.isNaN(id) || id < 1) {
    return { error: NextResponse.json({ error: "Invalid session" }, { status: 400 }) }
  }
  return { calisanId: id }
}

export async function GET() {
  try {
    const gate = await requireCalisanId()
    if ("error" in gate) return gate.error
    const { calisanId } = gate

    const conversations = await prisma.dmConversation.findMany({
      where: {
        OR: [{ lowerUserId: calisanId }, { higherUserId: calisanId }],
      },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            body: true,
            createdAt: true,
            senderId: true,
            attachmentFileName: true,
          },
        },
        readStates: {
          where: { calisanId },
          select: { lastReadMessageId: true },
        },
      },
    })

    const otherIds = conversations.map((c) => otherParticipantId(c, calisanId))
    const others = await prisma.calisan.findMany({
      where: { id: { in: otherIds } },
      select: {
        id: true,
        isim: true,
        soyisim: true,
        departman: true,
        profilFotoStoragePath: true,
      },
    })
    const otherMap = new Map(others.map((o) => [o.id, o]))

    const unreadCounts = await Promise.all(
      conversations.map(async (c) => {
        const myRead = c.readStates[0]?.lastReadMessageId ?? 0
        const n = await prisma.dmMessage.count({
          where: {
            conversationId: c.id,
            senderId: { not: calisanId },
            id: { gt: myRead },
          },
        })
        return { conversationId: c.id, unread: n }
      })
    )
    const unreadMap = new Map(unreadCounts.map((u) => [u.conversationId, u.unread]))

    const payload = conversations.map((c) => {
      const oid = otherParticipantId(c, calisanId)
      const o = otherMap.get(oid)
      const last = c.messages[0]
      const lastPreview =
        last &&
        ((last.body ?? "").trim()
          ? last.body
          : last.attachmentFileName
            ? `📎 ${last.attachmentFileName}`
            : "📎 File")
      return {
        id: c.id,
        updatedAt: c.updatedAt.toISOString(),
        other: {
          id: oid,
          isim: o?.isim ?? null,
          soyisim: o?.soyisim ?? null,
          departman: o?.departman ?? null,
          displayName:
            [o?.isim, o?.soyisim].filter(Boolean).join(" ") || `Employee #${oid}`,
          avatarUrl: calisanAvatarPublicUrl(o?.profilFotoStoragePath),
        },
        lastMessage: last
          ? {
              id: last.id,
              body: lastPreview ?? "",
              createdAt: last.createdAt.toISOString(),
              senderId: last.senderId,
              fromMe: last.senderId === calisanId,
            }
          : null,
        unreadCount: unreadMap.get(c.id) ?? 0,
      }
    })

    return NextResponse.json({ conversations: payload })
  } catch (e) {
    console.error("[GET /api/messages/conversations]", e)
    const message =
      process.env.NODE_ENV === "development" && e instanceof Error
        ? e.message
        : "Sunucu hatası"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireCalisanId()
    if ("error" in gate) return gate.error
    const { calisanId } = gate

    let body: { otherCalisanId?: number }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const otherId = Number(body.otherCalisanId)
    if (
      !Number.isFinite(otherId) ||
      otherId === calisanId ||
      calisanId < 1 ||
      otherId < 1
    ) {
      return NextResponse.json({ error: "Invalid recipient" }, { status: 400 })
    }

    const participants = await prisma.calisan.findMany({
      where: { id: { in: [calisanId, otherId] } },
      select: { id: true, isim: true, soyisim: true, departman: true },
    })
    const present = new Set(participants.map((p) => p.id))
    if (!present.has(calisanId)) {
      return NextResponse.json(
        {
          error:
            "Oturumunuz veritabanındaki çalışan kaydıyla eşleşmiyor. Çıkış yapıp tekrar giriş yapın.",
        },
        { status: 401 }
      )
    }
    if (!present.has(otherId)) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    const otherExists = participants.find((p) => p.id === otherId)!

    const { lowerUserId, higherUserId } = dmParticipantPair(calisanId, otherId)

    const conversation = await prisma.dmConversation.upsert({
      where: {
        lowerUserId_higherUserId: { lowerUserId, higherUserId },
      },
      create: {
        lowerUserId,
        higherUserId,
        readStates: {
          create: [
            { calisanId: lowerUserId },
            { calisanId: higherUserId },
          ],
        },
      },
      update: {},
      include: {
        readStates: true,
      },
    })

    if (conversation.readStates.length < 2) {
      await prisma.dmReadState.createMany({
        data: [
          { conversationId: conversation.id, calisanId: lowerUserId },
          { conversationId: conversation.id, calisanId: higherUserId },
        ],
        skipDuplicates: true,
      })
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        other: {
          id: otherExists.id,
          isim: otherExists.isim,
          soyisim: otherExists.soyisim,
          departman: otherExists.departman,
          displayName:
            [otherExists.isim, otherExists.soyisim].filter(Boolean).join(" ") ||
            `Employee #${otherExists.id}`,
        },
      },
    })
  } catch (e) {
    console.error("[POST /api/messages/conversations]", e)
    const message =
      process.env.NODE_ENV === "development" && e instanceof Error
        ? e.message
        : "Sunucu hatası"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
