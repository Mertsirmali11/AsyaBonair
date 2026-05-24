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

type MemberReadState = {
  calisanId: number
  displayName: string
  lastReadMessageId: number
  readAt: string
}

function computeSeenBy(
  messageId: number,
  senderId: number,
  viewerId: number,
  readStates: MemberReadState[]
) {
  if (senderId !== viewerId) return []
  return readStates
    .filter(
      (r) =>
        r.calisanId !== senderId && r.lastReadMessageId >= messageId
    )
    .map((r) => ({
      id: r.calisanId,
      displayName: r.displayName,
      readAt: r.readAt,
    }))
}

function mapMessage(
  m: MsgRow,
  calisanId: number,
  readStates: MemberReadState[],
  senderDisplayName?: string
) {
  const seenBy = computeSeenBy(m.id, m.senderId, calisanId, readStates)
  const base = {
    id: m.id,
    body: m.body,
    senderId: m.senderId,
    createdAt: m.createdAt.toISOString(),
    fromMe: m.senderId === calisanId,
    readByOther: seenBy.length > 0,
    seenBy,
    readByCount: seenBy.length,
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

async function getConversationReadStates(
  conversationId: number,
  conv: {
    isGroup: boolean
    lowerUserId: number | null
    higherUserId: number | null
    members: { calisanId: number }[]
  }
): Promise<MemberReadState[]> {
  const participantIds = conv.isGroup
    ? conv.members.map((m) => m.calisanId)
    : [conv.lowerUserId, conv.higherUserId].filter(
        (id): id is number => id != null
      )

  if (participantIds.length === 0) return []

  const [readStates, calisans] = await Promise.all([
    prisma.dmReadState.findMany({
      where: { conversationId, calisanId: { in: participantIds } },
      select: {
        calisanId: true,
        lastReadMessageId: true,
        updatedAt: true,
      },
    }),
    prisma.calisan.findMany({
      where: { id: { in: participantIds } },
      select: { id: true, isim: true, soyisim: true },
    }),
  ])

  const nameMap = new Map(
    calisans.map((c) => [
      c.id,
      [c.isim, c.soyisim].filter(Boolean).join(" ").trim() ||
        `Çalışan #${c.id}`,
    ])
  )

  return readStates.map((r) => ({
    calisanId: r.calisanId,
    displayName: nameMap.get(r.calisanId) ?? `Çalışan #${r.calisanId}`,
    lastReadMessageId: r.lastReadMessageId ?? 0,
    readAt: r.updatedAt.toISOString(),
  }))
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
  readStates: MemberReadState[],
  extra: Record<string, unknown>
) {
  const otherLastRead = readStates
    .filter((r) => r.calisanId !== calisanId)
    .reduce((max, r) => Math.max(max, r.lastReadMessageId), 0)

  if (!conv.isGroup) {
    return NextResponse.json({
      ...extra,
      messages: rows.map((m) => mapMessage(m, calisanId, readStates)),
      otherLastReadMessageId: otherLastRead,
      memberReadStates: readStates,
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
      mapMessage(m, calisanId, readStates, nameMap.get(m.senderId) ?? `#${m.senderId}`)
    ),
    otherLastReadMessageId: otherLastRead,
    memberReadStates: readStates,
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

  let readStates: MemberReadState[] = []
  let avatarPair: { myAvatarUrl: string | null; otherAvatarUrl: string | null }

  readStates = await getConversationReadStates(conversationId, conv)

  if (!conv.isGroup) {
    const otherId = otherParticipantId(conv, calisanId)
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
    return buildListPayload(rows, conv, calisanId, readStates, {
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
    return buildListPayload(asc, conv, calisanId, readStates, {
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

  return buildListPayload(asc, conv, calisanId, readStates, {
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

  const readStates = await getConversationReadStates(conversationId, conv)

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
    ? mapMessage(msg, calisanId, readStates, senderDisplayName)
    : mapMessage(msg, calisanId, readStates)

  return NextResponse.json({
    message: messagePayload,
  })
}
