import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { calisanAvatarPublicUrl } from "@/lib/calisan-avatar"
import { prisma } from "@/lib/prisma-server"
import { isDmMember, otherParticipantId } from "@/lib/dm"
import { broadcastDmInboxMany } from "@/lib/dm-broadcast"
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
  otherLastRead: number,
  senderDisplayName?: string
) {
  const base = {
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
  if (senderDisplayName !== undefined) {
    return { ...base, senderDisplayName }
  }
  return base
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

async function groupMembersJson(conversationId: number) {
  const rows = await prisma.dmConversationMember.findMany({
    where: { conversationId },
    select: {
      calisanId: true,
      calisan: {
        select: {
          id: true,
          isim: true,
          soyisim: true,
          departman: true,
          profilFotoStoragePath: true,
        },
      },
    },
  })
  const members = rows.map((m) => {
    const cal = m.calisan
    const displayName =
      [cal?.isim, cal?.soyisim].filter(Boolean).join(" ").trim() ||
      `Çalışan #${m.calisanId}`
    return {
      id: m.calisanId,
      displayName,
      departman: cal?.departman ?? null,
      avatarUrl: calisanAvatarPublicUrl(cal?.profilFotoStoragePath),
    }
  })
  members.sort((a, b) => a.displayName.localeCompare(b.displayName, "tr"))
  return members
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
    select: {
      id: true,
      isGroup: true,
      groupTitle: true,
      lowerUserId: true,
      higherUserId: true,
      members: { select: { calisanId: true } },
    },
  })
  if (!c) return null
  if (!isDmMember(c, calisanId)) return null
  return c
}

async function buildListPayload(
  rows: MsgRow[],
  conv: NonNullable<Awaited<ReturnType<typeof assertMember>>>,
  calisanId: number,
  otherLastRead: number,
  extra: Record<string, unknown>
) {
  if (!conv.isGroup) {
    return NextResponse.json({
      ...extra,
      messages: rows.map((m) => mapMessage(m, calisanId, otherLastRead)),
      otherLastReadMessageId: otherLastRead,
    })
  }

  const senderIds = [...new Set(rows.map((r) => r.senderId))]
  const senders = await prisma.calisan.findMany({
    where: { id: { in: senderIds } },
    select: { id: true, isim: true, soyisim: true },
  })
  const nameMap = new Map(
    senders.map((s) => [
      s.id,
      [s.isim, s.soyisim].filter(Boolean).join(" ") || `Çalışan #${s.id}`,
    ])
  )

  return NextResponse.json({
    ...extra,
    messages: rows.map((m) =>
      mapMessage(m, calisanId, 0, nameMap.get(m.senderId) ?? `#${m.senderId}`)
    ),
    otherLastReadMessageId: 0,
  })
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

  let otherLastRead = 0
  let avatarPair: { myAvatarUrl: string | null; otherAvatarUrl: string | null }

  if (!conv.isGroup) {
    const otherId = otherParticipantId(conv, calisanId)
    otherLastRead = await getOtherLastRead(conversationId, otherId)
    avatarPair = await avatarUrlsForDmParticipants(calisanId, otherId)
  } else {
    const meRow = await prisma.calisan.findUnique({
      where: { id: calisanId },
      select: { profilFotoStoragePath: true },
    })
    avatarPair = {
      myAvatarUrl: calisanAvatarPublicUrl(meRow?.profilFotoStoragePath),
      otherAvatarUrl: null,
    }
  }

  const sp = request.nextUrl.searchParams
  const limitRaw = Number.parseInt(sp.get("limit") ?? "", 10)
  const limit = Number.isFinite(limitRaw)
    ? Math.min(MAX_LIMIT, Math.max(1, limitRaw))
    : DEFAULT_LIMIT

  const sinceRaw = sp.get("since")
  const beforeRaw = sp.get("before")

  const membersPayload = conv.isGroup
    ? await groupMembersJson(conversationId)
    : null

  const commonExtra = {
    isGroup: conv.isGroup,
    groupTitle: conv.groupTitle,
    ...avatarPair,
    members: membersPayload,
  }

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
    return buildListPayload(rows, conv, calisanId, otherLastRead, {
      mode: "since" as const,
      ...commonExtra,
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
    return buildListPayload(asc, conv, calisanId, otherLastRead, {
      mode: "older" as const,
      hasOlder,
      ...commonExtra,
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

  return buildListPayload(asc, conv, calisanId, otherLastRead, {
    mode: "latest" as const,
    hasOlder,
    ...commonExtra,
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

  let otherLastRead = 0
  if (!conv.isGroup) {
    const otherId = otherParticipantId(conv, calisanId)
    otherLastRead = await getOtherLastRead(conversationId, otherId)
  }

  const targets = conv.isGroup
    ? conv.members.map((m) => m.calisanId)
    : [conv.lowerUserId!, conv.higherUserId!]

  void broadcastDmInboxMany(conversationId, targets)

  const senderRow = await prisma.calisan.findUnique({
    where: { id: calisanId },
    select: { isim: true, soyisim: true },
  })
  const senderDisplayName =
    [senderRow?.isim, senderRow?.soyisim].filter(Boolean).join(" ") ||
    `Çalışan #${calisanId}`

  const messagePayload = conv.isGroup
    ? mapMessage(msg, calisanId, 0, senderDisplayName)
    : mapMessage(msg, calisanId, otherLastRead)

  return NextResponse.json({
    message: messagePayload,
  })
}
