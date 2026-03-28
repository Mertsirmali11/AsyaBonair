import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { calisanAvatarPublicUrl } from "@/lib/calisan-avatar"
import { prisma } from "@/lib/prisma-server"
import { otherParticipantId } from "@/lib/dm"
import { broadcastDmInboxBoth } from "@/lib/dm-broadcast"
import { uploadDmAttachmentToStorage } from "@/lib/supabase-storage"

const MAX_BODY = 8000
const DEFAULT_LIMIT = 40
const MAX_LIMIT = 100

const messageSelect = {
  id: true,
  body: true,
  senderId: true,
  createdAt: true,
  attachmentFileName: true,
  attachmentMime: true,
  attachmentSize: true,
  attachmentPublicUrl: true,
} as const

type MsgRow = {
  id: number
  body: string
  senderId: number
  createdAt: Date
  attachmentFileName: string | null
  attachmentMime: string | null
  attachmentSize: number | null
  attachmentPublicUrl: string | null
}

function mapMessage(
  m: MsgRow,
  calisanId: number,
  otherLastRead: number
) {
  return {
    id: m.id,
    body: m.body,
    senderId: m.senderId,
    createdAt: m.createdAt.toISOString(),
    fromMe: m.senderId === calisanId,
    readByOther: m.senderId === calisanId && otherLastRead >= m.id,
    attachment: m.attachmentPublicUrl
      ? {
          url: m.attachmentPublicUrl,
          fileName: m.attachmentFileName ?? "file",
          mime: m.attachmentMime ?? "application/octet-stream",
          size: m.attachmentSize ?? 0,
        }
      : null,
  }
}

async function avatarUrlsForDmParticipants(myId: number, otherId: number) {
  const rows = await prisma.calisan.findMany({
    where: { id: { in: [myId, otherId] } },
    select: { id: true, profilFotoStoragePath: true },
  })
  const map = new Map(
    rows.map(
      (r) =>
        [r.id, calisanAvatarPublicUrl(r.profilFotoStoragePath)] as [
          number,
          string | null,
        ]
    )
  )
  return {
    myAvatarUrl: map.get(myId) ?? null,
    otherAvatarUrl: map.get(otherId) ?? null,
  }
}

async function getOtherLastRead(conversationId: number, otherId: number) {
  const otherRead = await prisma.dmReadState.findUnique({
    where: {
      conversationId_calisanId: {
        conversationId,
        calisanId: otherId,
      },
    },
    select: { lastReadMessageId: true },
  })
  return otherRead?.lastReadMessageId ?? 0
}

async function getMe() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const id = Number.parseInt(session.user.id, 10)
  if (Number.isNaN(id)) {
    return { error: NextResponse.json({ error: "Invalid session" }, { status: 400 }) }
  }
  return { calisanId: id }
}

async function assertMember(conversationId: number, calisanId: number) {
  const c = await prisma.dmConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, lowerUserId: true, higherUserId: true },
  })
  if (!c) return null
  if (c.lowerUserId !== calisanId && c.higherUserId !== calisanId) return null
  return c
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await getMe()
  if ("error" in gate) return gate.error
  const { calisanId } = gate

  const { id: raw } = await params
  const conversationId = Number.parseInt(raw, 10)
  if (Number.isNaN(conversationId)) {
    return NextResponse.json({ error: "Invalid conversation" }, { status: 400 })
  }

  const conv = await assertMember(conversationId, calisanId)
  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const otherId = otherParticipantId(conv, calisanId)
  const otherLastRead = await getOtherLastRead(conversationId, otherId)
  const avatarPair = await avatarUrlsForDmParticipants(calisanId, otherId)

  const sp = request.nextUrl.searchParams
  const limitRaw = Number.parseInt(sp.get("limit") ?? "", 10)
  const limit = Number.isFinite(limitRaw)
    ? Math.min(MAX_LIMIT, Math.max(1, limitRaw))
    : DEFAULT_LIMIT

  const sinceRaw = sp.get("since")
  const beforeRaw = sp.get("before")

  if (sinceRaw !== null && sinceRaw !== "") {
    const sinceId = Number.parseInt(sinceRaw, 10)
    if (Number.isNaN(sinceId)) {
      return NextResponse.json({ error: "Invalid since parameter" }, { status: 400 })
    }
    const rows = await prisma.dmMessage.findMany({
      where: { conversationId, id: { gt: sinceId } },
      orderBy: { id: "asc" },
      take: 200,
      select: messageSelect,
    })
    return NextResponse.json({
      mode: "since" as const,
      messages: rows.map((m) => mapMessage(m, calisanId, otherLastRead)),
      otherLastReadMessageId: otherLastRead,
      ...avatarPair,
    })
  }

  if (beforeRaw !== null && beforeRaw !== "") {
    const beforeId = Number.parseInt(beforeRaw, 10)
    if (Number.isNaN(beforeId)) {
      return NextResponse.json({ error: "Invalid before parameter" }, { status: 400 })
    }
    const rows = await prisma.dmMessage.findMany({
      where: { conversationId, id: { lt: beforeId } },
      orderBy: { id: "desc" },
      take: limit + 1,
      select: messageSelect,
    })
    const hasOlder = rows.length > limit
    const page = hasOlder ? rows.slice(0, limit) : rows
    const asc = [...page].reverse()
    return NextResponse.json({
      mode: "older" as const,
      messages: asc.map((m) => mapMessage(m, calisanId, otherLastRead)),
      otherLastReadMessageId: otherLastRead,
      hasOlder,
      ...avatarPair,
    })
  }

  const rows = await prisma.dmMessage.findMany({
    where: { conversationId },
    orderBy: { id: "desc" },
    take: limit + 1,
    select: messageSelect,
  })
  const hasOlder = rows.length > limit
  const page = hasOlder ? rows.slice(0, limit) : rows
  const asc = [...page].reverse()

  return NextResponse.json({
    mode: "latest" as const,
    messages: asc.map((m) => mapMessage(m, calisanId, otherLastRead)),
    otherLastReadMessageId: otherLastRead,
    hasOlder,
    ...avatarPair,
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await getMe()
  if ("error" in gate) return gate.error
  const { calisanId } = gate

  const { id: raw } = await params
  const conversationId = Number.parseInt(raw, 10)
  if (Number.isNaN(conversationId)) {
    return NextResponse.json({ error: "Invalid conversation" }, { status: 400 })
  }

  const conv = await assertMember(conversationId, calisanId)
  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const contentType = request.headers.get("content-type") || ""
  let text = ""
  let file: File | null = null

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData()
    text = String(form.get("body") ?? "").trim()
    const f = form.get("file")
    file = f instanceof File && f.size > 0 ? f : null
  } else {
    let body: { body?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    text = (body.body ?? "").trim()
  }

  if (!text && !file) {
    return NextResponse.json(
      { error: "Message text or file is required" },
      { status: 400 }
    )
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 })
  }

  let attachmentPath: string | null = null
  let attachmentFileName: string | null = null
  let attachmentMime: string | null = null
  let attachmentSize: number | null = null
  let attachmentPublicUrl: string | null = null

  if (file) {
    const up = await uploadDmAttachmentToStorage(file, conversationId, calisanId)
    if (!up) {
      return NextResponse.json(
        { error: "Upload failed or file type not allowed (max 20 MB)" },
        { status: 400 }
      )
    }
    attachmentPath = up.path
    attachmentFileName = up.fileName
    attachmentMime = up.mimeType
    attachmentSize = up.size
    attachmentPublicUrl = up.publicUrl
  }

  const msg = await prisma.dmMessage.create({
    data: {
      conversationId,
      senderId: calisanId,
      body: text,
      attachmentPath,
      attachmentFileName,
      attachmentMime,
      attachmentSize,
      attachmentPublicUrl,
    },
    select: messageSelect,
  })

  await prisma.dmConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  })

  const otherId = otherParticipantId(conv, calisanId)
  const otherLastRead = await getOtherLastRead(conversationId, otherId)

  void broadcastDmInboxBoth(
    conversationId,
    conv.lowerUserId,
    conv.higherUserId
  )

  return NextResponse.json({
    message: mapMessage(msg, calisanId, otherLastRead),
  })
}
