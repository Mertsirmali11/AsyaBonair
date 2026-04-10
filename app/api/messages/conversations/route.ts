import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { calisanAvatarPublicUrl } from "@/lib/calisan-avatar"
import { prisma } from "@/lib/prisma-server"
import { dmParticipantPair, otherParticipantId } from "@/lib/dm"
import { dmUnreadCountsByConversationIds } from "@/lib/dm-unread-batch"

const MAX_GROUP_MEMBERS = 200
const MAX_GROUP_TITLE = 200

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
        OR: [
          {
            isGroup: false,
            OR: [{ lowerUserId: calisanId }, { higherUserId: calisanId }],
          },
          {
            isGroup: true,
            members: { some: { calisanId } },
          },
        ],
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
        members: { select: { calisanId: true } },
      },
    })

    const directConvs = conversations.filter((c) => !c.isGroup)
    const otherIds = directConvs.map((c) => otherParticipantId(c, calisanId))
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

    const unreadMap = await dmUnreadCountsByConversationIds(
      prisma,
      calisanId,
      conversations.map((c) => c.id)
    )

    const payload = conversations.map((c) => {
      const last = c.messages[0]
      const lastPreview =
        last &&
        ((last.body ?? "").trim()
          ? last.body
          : last.attachmentFileName
            ? `📎 ${last.attachmentFileName}`
            : "📎 File")

      if (c.isGroup) {
        const n = c.members.length
        return {
          id: c.id,
          isGroup: true as const,
          updatedAt: c.updatedAt.toISOString(),
          other: {
            id: 0,
            isim: null,
            soyisim: null,
            departman: `${n} kişi`,
            displayName: (c.groupTitle ?? "").trim() || "Grup",
            avatarUrl: null as string | null,
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
      }

      const oid = otherParticipantId(c, calisanId)
      const o = otherMap.get(oid)
      return {
        id: c.id,
        isGroup: false as const,
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

    let body: {
      otherCalisanId?: number
      isGroup?: boolean
      title?: string
      memberCalisanIds?: unknown[]
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    if (body.isGroup === true) {
      const title = String(body.title ?? "").trim()
      if (title.length < 1 || title.length > MAX_GROUP_TITLE) {
        return NextResponse.json(
          { error: "Grup adı 1–200 karakter olmalı." },
          { status: 400 }
        )
      }

      const raw = body.memberCalisanIds
      if (!Array.isArray(raw)) {
        return NextResponse.json(
          { error: "memberCalisanIds bir dizi olmalı." },
          { status: 400 }
        )
      }

      const others = new Set<number>()
      for (const x of raw) {
        const id = typeof x === "number" ? x : Number.parseInt(String(x), 10)
        if (!Number.isFinite(id) || id < 1 || id === calisanId) continue
        others.add(id)
      }

      if (others.size < 1) {
        return NextResponse.json(
          { error: "Gruba en az bir kişi ekleyin (kendiniz otomatik dahil)." },
          { status: 400 }
        )
      }

      if (others.size > MAX_GROUP_MEMBERS) {
        return NextResponse.json(
          { error: `En fazla ${MAX_GROUP_MEMBERS} üye eklenebilir.` },
          { status: 400 }
        )
      }

      const memberIds = [calisanId, ...others]
      const found = await prisma.calisan.findMany({
        where: { id: { in: memberIds } },
        select: { id: true },
      })
      if (found.length !== memberIds.length) {
        return NextResponse.json(
          { error: "Bazı kullanıcılar bulunamadı." },
          { status: 404 }
        )
      }

      const present = new Set(found.map((p) => p.id))
      if (!present.has(calisanId)) {
        return NextResponse.json(
          {
            error:
              "Oturumunuz veritabanındaki çalışan kaydıyla eşleşmiyor. Çıkış yapıp tekrar giriş yapın.",
          },
          { status: 401 }
        )
      }

      const conversation = await prisma.dmConversation.create({
        data: {
          isGroup: true,
          groupTitle: title,
          lowerUserId: null,
          higherUserId: null,
          members: {
            create: memberIds.map((id) => ({ calisanId: id })),
          },
          readStates: {
            create: memberIds.map((id) => ({ calisanId: id })),
          },
        },
        select: { id: true },
      })

      return NextResponse.json({
        conversation: {
          id: conversation.id,
          isGroup: true,
          title,
        },
      })
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
        isGroup: false,
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
        isGroup: false,
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
