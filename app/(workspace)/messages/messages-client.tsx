"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  MessageCirclePlus,
  Paperclip,
  Search,
  SendHorizontal,
  Trash2,
  UsersRound,
} from "lucide-react"

import { useDmInboxRealtime } from "@/hooks/use-dm-inbox-realtime"
import { useIsMobile } from "@/hooks/use-mobile"
import { formatTimeOnlyIstanbul } from "@/lib/date-format"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type Colleague = {
  id: number
  isim: string | null
  soyisim: string | null
  departman: string | null
  displayName: string
  avatarUrl?: string | null
}

type ConvMember = {
  id: number
  displayName: string
  departman: string | null
  avatarUrl?: string | null
}

type ConvRow = {
  id: number
  isGroup: boolean
  updatedAt: string
  members?: ConvMember[]
  other: {
    id: number
    isim: string | null
    soyisim: string | null
    departman: string | null
    displayName: string
    avatarUrl?: string | null
  }
  lastMessage: {
    id: number
    body: string
    createdAt: string
    senderId: number
    fromMe: boolean
  } | null
  unreadCount: number
}

type ChatAttachment = {
  url: string
  fileName: string
  mime: string
  size: number
}

type SeenByMember = {
  id: number
  displayName: string
  readAt: string | null
}

type MemberReadState = {
  calisanId: number
  displayName: string
  lastReadMessageId: number
  readAt: string
}

type ChatMessage = {
  id: number
  body: string
  senderId: number
  createdAt: string
  fromMe: boolean
  readByOther: boolean
  seenBy?: SeenByMember[]
  readByCount?: number
  attachment: ChatAttachment | null
  senderDisplayName?: string
}

/** Proje primary (slate) ile uyumlu başlık */
const CHAT_HEADER = "bg-primary text-primary-foreground"
/** Konuşma gövdesi — muted ton, WhatsApp kremi değil */
const CHAT_THREAD_BG =
  "bg-muted/50 dark:bg-muted/20"
const CHAT_LIST_BG = "bg-card"
const BUBBLE_OUT =
  "border border-border bg-primary/8 dark:bg-primary/15"
const BUBBLE_IN = "border border-border bg-card shadow-sm"
const CHAT_COMPOSER = "border-t border-border bg-muted/40 dark:bg-muted/25"

function previewText(s: string, max = 56) {
  const t = s.replace(/\s+/g, " ").trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

function formatListTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  if (sameDay) return formatTimeOnlyIstanbul(d).slice(0, 5)
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Istanbul",
  }).format(d)
}

function formatFileSize(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function initialsFromDisplayName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase() || "?"
  }
  return (parts[0]?.[0] ?? "?").toUpperCase()
}

type ChatAvatars = { my: string | null; other: string | null }

function readAvatarPairFromPayload(data: unknown): ChatAvatars | null {
  if (!data || typeof data !== "object") return null
  const o = data as Record<string, unknown>
  if (!("myAvatarUrl" in o) || !("otherAvatarUrl" in o)) return null
  return {
    my: (o.myAvatarUrl as string | null) ?? null,
    other: (o.otherAvatarUrl as string | null) ?? null,
  }
}

function readMembersFromPayload(data: unknown): ConvMember[] {
  if (!data || typeof data !== "object") return []
  const raw = (data as Record<string, unknown>).members
  if (raw == null) return []
  if (!Array.isArray(raw)) return []
  const out: ConvMember[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const x = item as Record<string, unknown>
    const id = Number(x.id)
    const displayName = String(x.displayName ?? "").trim()
    if (!Number.isFinite(id) || !displayName) continue
    out.push({
      id,
      displayName,
      departman: x.departman != null ? String(x.departman) : null,
      avatarUrl:
        x.avatarUrl === undefined || x.avatarUrl === null
          ? null
          : String(x.avatarUrl),
    })
  }
  return out
}

function readMemberReadStatesFromPayload(data: unknown): MemberReadState[] {
  if (!data || typeof data !== "object") return []
  const raw = (data as Record<string, unknown>).memberReadStates
  if (!Array.isArray(raw)) return []
  const out: MemberReadState[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const x = item as Record<string, unknown>
    const calisanId = Number(x.calisanId)
    const lastReadMessageId = Number(x.lastReadMessageId ?? 0)
    const displayName = String(x.displayName ?? "").trim()
    const readAt = String(x.readAt ?? "")
    if (!Number.isFinite(calisanId) || !displayName) continue
    out.push({
      calisanId,
      displayName,
      lastReadMessageId: Number.isFinite(lastReadMessageId)
        ? lastReadMessageId
        : 0,
      readAt,
    })
  }
  return out
}

function formatSeenByLabel(seenBy: SeenByMember[]): string {
  if (seenBy.length === 0) return ""
  if (seenBy.length === 1) return seenBy[0]!.displayName
  if (seenBy.length === 2) {
    return `${seenBy[0]!.displayName}, ${seenBy[1]!.displayName}`
  }
  return `${seenBy[0]!.displayName}, ${seenBy[1]!.displayName} +${seenBy.length - 2}`
}

export function MessagesClient({
  currentCalisanId,
  currentUserName,
  currentUserAvatarUrl,
}: {
  currentCalisanId: number
  currentUserName?: string | null
  currentUserAvatarUrl?: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const openFromQuery = searchParams.get("c")

  const isMobile = useIsMobile()
  const [colleagues, setColleagues] = useState<Colleague[]>([])
  const [conversations, setConversations] = useState<ConvRow[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasOlder, setHasOlder] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [draft, setDraft] = useState("")
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [listQuery, setListQuery] = useState("")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState("")
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [groupTitle, setGroupTitle] = useState("")
  const [groupMemberIds, setGroupMemberIds] = useState<number[]>([])
  const [groupPickerQuery, setGroupPickerQuery] = useState("")
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [startingChatWithId, setStartingChatWithId] = useState<number | null>(
    null
  )
  const [loadingList, setLoadingList] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const [realtimeLive, setRealtimeLive] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ConvRow | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [chatAvatars, setChatAvatars] = useState<ChatAvatars | null>(null)
  const [membersFromMessages, setMembersFromMessages] = useState<ConvMember[]>(
    []
  )
  const [memberReadStates, setMemberReadStates] = useState<MemberReadState[]>(
    []
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<number | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const loadingOlderRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const startingChatRef = useRef(false)

  selectedRef.current = selectedId
  messagesRef.current = messages

  const selectedConv = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  )

  const displayMembers = useMemo((): ConvMember[] => {
    if (!selectedConv) return []
    if (selectedConv.isGroup) {
      const fromList = selectedConv.members ?? []
      if (fromList.length > 0) return fromList
      return membersFromMessages
    }
    const o = selectedConv.other
    return [
      {
        id: o.id,
        displayName: o.displayName,
        departman: o.departman,
        avatarUrl: o.avatarUrl,
      },
    ]
  }, [selectedConv, membersFromMessages])

  const attachmentHistory = useMemo(() => {
    return messages
      .filter((m) => m.attachment)
      .slice()
      .sort((a, b) => b.id - a.id)
      .map((m) => ({
        id: m.id,
        attachment: m.attachment!,
      }))
  }, [messages])

  const [chatDetailsOpen, setChatDetailsOpen] = useState(false)

  const applyReadStates = useCallback(
    (readStates: MemberReadState[], list: ChatMessage[]) => {
      return list.map((m) => {
        if (!m.fromMe) return m
        const seenBy = readStates
          .filter(
            (r) =>
              r.calisanId !== currentCalisanId &&
              r.lastReadMessageId >= m.id
          )
          .map((r) => ({
            id: r.calisanId,
            displayName: r.displayName,
            readAt: r.readAt || null,
          }))
        return {
          ...m,
          seenBy,
          readByOther: seenBy.length > 0,
          readByCount: seenBy.length,
        }
      })
    },
    [currentCalisanId]
  )

  const mergeReadStatesFromPayload = useCallback((data: unknown) => {
    const next = readMemberReadStatesFromPayload(data)
    if (next.length > 0) setMemberReadStates(next)
    return next
  }, [])

  const loadColleagues = useCallback(async () => {
    const res = await fetch("/api/messages/colleagues")
    if (!res.ok) return
    const data = await res.json()
    const list = (data.colleagues ?? []) as Colleague[]
    setColleagues(list.filter((c) => c.id !== currentCalisanId))
  }, [currentCalisanId])

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/messages/conversations")
    if (!res.ok) return
    const data = await res.json()
    setConversations(data.conversations ?? [])
  }, [])

  const syncRealtimeForConversation = useCallback(
    async (cid: number) => {
      const prev = messagesRef.current
      const maxId = prev.reduce((acc, m) => Math.max(acc, m.id), 0)

      if (maxId === 0) {
        const res = await fetch(`/api/messages/conversations/${cid}/messages`)
        if (!res.ok) return
        const data = await res.json()
        const av = readAvatarPairFromPayload(data)
        if (av) setChatAvatars(av)
        const mem = readMembersFromPayload(data)
        if (mem.length) setMembersFromMessages(mem)
        const readStates = mergeReadStatesFromPayload(data)
        const list = (data.messages ?? []) as ChatMessage[]
        setMessages(applyReadStates(readStates, list))
        setHasOlder(!!data.hasOlder)
        await fetch(`/api/messages/conversations/${cid}/read`, { method: "POST" })
        return
      }

      const res = await fetch(
        `/api/messages/conversations/${cid}/messages?since=${maxId}`
      )
      if (!res.ok) return
      const data = await res.json()
      const av = readAvatarPairFromPayload(data)
      if (av) setChatAvatars(av)
      const mem = readMembersFromPayload(data)
      if (mem.length) setMembersFromMessages(mem)
      const readStates = mergeReadStatesFromPayload(data)
      const newMsgs = (data.messages ?? []) as ChatMessage[]

      if (newMsgs.length === 0) {
        setMessages((cur) => applyReadStates(readStates, cur))
        return
      }

      setMessages((cur) => {
        const byId = new Map<number, ChatMessage>()
        for (const m of cur) byId.set(m.id, m)
        for (const m of newMsgs) byId.set(m.id, m)
        const merged = Array.from(byId.values()).sort((a, b) => a.id - b.id)
        return applyReadStates(readStates, merged)
      })
      await fetch(`/api/messages/conversations/${cid}/read`, { method: "POST" })
    },
    [applyReadStates, mergeReadStatesFromPayload]
  )

  const loadMessages = useCallback(
    async (conversationId: number) => {
      setLoadingMessages(true)
      setMessages([])
      setMembersFromMessages([])
      setMemberReadStates([])
      setHasOlder(false)
      const convRow = conversations.find((c) => c.id === conversationId)
      setChatAvatars({
        my: currentUserAvatarUrl ?? null,
        other: convRow?.other.avatarUrl ?? null,
      })
      try {
        const res = await fetch(
          `/api/messages/conversations/${conversationId}/messages`
        )
        if (!res.ok) return
        const data = await res.json()
        const av = readAvatarPairFromPayload(data)
        if (av) setChatAvatars(av)
        const mem = readMembersFromPayload(data)
        if (mem.length) setMembersFromMessages(mem)
        const readStates = mergeReadStatesFromPayload(data)
        const list = (data.messages ?? []) as ChatMessage[]
        setMessages(applyReadStates(readStates, list))
        setHasOlder(!!data.hasOlder)
        await fetch(`/api/messages/conversations/${conversationId}/read`, {
          method: "POST",
        })
        loadConversations()
      } finally {
        setLoadingMessages(false)
      }
    },
    [
      applyReadStates,
      mergeReadStatesFromPayload,
      loadConversations,
      conversations,
      currentUserAvatarUrl,
    ]
  )

  const loadOlderMessages = useCallback(async () => {
    const cid = selectedRef.current
    if (cid == null || !hasOlder || loadingOlderRef.current) return
    const oldest = messagesRef.current[0]?.id
    if (!oldest) return

    loadingOlderRef.current = true
    setLoadingOlder(true)
    const el = scrollRef.current
    const prevScrollHeight = el?.scrollHeight ?? 0
    const prevScrollTop = el?.scrollTop ?? 0

    try {
      const res = await fetch(
        `/api/messages/conversations/${cid}/messages?before=${oldest}`
      )
      if (!res.ok) return
      const data = await res.json()
      const av = readAvatarPairFromPayload(data)
      if (av) setChatAvatars(av)
      const mem = readMembersFromPayload(data)
      if (mem.length) setMembersFromMessages(mem)
      const readStates = mergeReadStatesFromPayload(data)
      const older = (data.messages ?? []) as ChatMessage[]
      setHasOlder(!!data.hasOlder)
      setMessages((cur) => {
        const byId = new Map<number, ChatMessage>()
        for (const m of older) byId.set(m.id, m)
        for (const m of cur) byId.set(m.id, m)
        const merged = Array.from(byId.values()).sort((a, b) => a.id - b.id)
        return applyReadStates(readStates, merged)
      })
      requestAnimationFrame(() => {
        const scrollEl = scrollRef.current
        if (scrollEl) {
          scrollEl.scrollTop =
            scrollEl.scrollHeight - prevScrollHeight + prevScrollTop
        }
      })
    } finally {
      loadingOlderRef.current = false
      setLoadingOlder(false)
    }
  }, [hasOlder, applyReadStates, mergeReadStatesFromPayload])

  const onInboxRealtime = useCallback(
    (conversationId?: number) => {
      void loadConversations()
      if (
        typeof conversationId === "number" &&
        selectedRef.current === conversationId
      ) {
        void syncRealtimeForConversation(conversationId)
      }
    },
    [loadConversations, syncRealtimeForConversation]
  )

  useDmInboxRealtime(currentCalisanId, onInboxRealtime, setRealtimeLive)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingList(true)
      await Promise.all([loadColleagues(), loadConversations()])
      if (!cancelled) setLoadingList(false)
    })()
    return () => {
      cancelled = true
    }
  }, [loadColleagues, loadConversations])

  useEffect(() => {
    const intervalMs = realtimeLive ? 45000 : 10000
    const t = window.setInterval(() => {
      loadConversations()
    }, intervalMs)
    return () => window.clearInterval(t)
  }, [loadConversations, realtimeLive])

  useEffect(() => {
    if (selectedId == null || realtimeLive) return
    const id = selectedId
    const t = window.setInterval(() => {
      void (async () => {
        await syncRealtimeForConversation(id)
      })()
    }, 5000)
    return () => window.clearInterval(t)
  }, [selectedId, realtimeLive, syncRealtimeForConversation])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [messages.length, selectedId])

  useEffect(() => {
    setDraft("")
    setPendingFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [selectedId])

  useEffect(() => {
    setChatDetailsOpen(false)
  }, [selectedId])

  const openConversation = useCallback(
    (conversationId: number) => {
      setSelectedId(conversationId)
      setMobileChatOpen(true)
      void loadMessages(conversationId)
    },
    [loadMessages]
  )

  useEffect(() => {
    if (!openFromQuery) return
    const id = Number.parseInt(openFromQuery, 10)
    if (!Number.isFinite(id) || id < 1) return
    openConversation(id)
    router.replace("/messages", { scroll: false })
  }, [openFromQuery, openConversation, router])

  const startWithColleague = useCallback(
    async (otherId: number) => {
      if (startingChatRef.current) return
      startingChatRef.current = true
      setStartingChatWithId(otherId)
      try {
        const res = await fetch("/api/messages/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ otherCalisanId: otherId }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          conversation?: { id: number }
        }
        if (!res.ok) {
          toast.error(
            data.error ?? `Sohbet açılamadı (${res.status}). Tekrar deneyin.`
          )
          return
        }
        setPickerOpen(false)
        setPickerQuery("")
        await loadConversations()
        const cid = data.conversation?.id
        if (typeof cid === "number") openConversation(cid)
        else toast.error("Sunucu yanıtı geçersiz.")
      } catch {
        toast.error("Bağlantı hatası. İnternetinizi kontrol edin.")
      } finally {
        startingChatRef.current = false
        setStartingChatWithId(null)
      }
    },
    [loadConversations, openConversation]
  )

  const createGroup = useCallback(async () => {
    const title = groupTitle.trim()
    if (title.length < 1 || groupMemberIds.length < 1 || creatingGroup) return
    setCreatingGroup(true)
    try {
      const res = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isGroup: true,
          title,
          memberCalisanIds: groupMemberIds,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        conversation?: { id: number }
      }
      if (!res.ok) {
        toast.error(data.error ?? `Grup oluşturulamadı (${res.status}).`)
        return
      }
      setGroupDialogOpen(false)
      setGroupTitle("")
      setGroupMemberIds([])
      setGroupPickerQuery("")
      await loadConversations()
      const cid = data.conversation?.id
      if (typeof cid === "number") openConversation(cid)
      else toast.error("Sunucu yanıtı geçersiz.")
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setCreatingGroup(false)
    }
  }, [
    groupTitle,
    groupMemberIds,
    creatingGroup,
    loadConversations,
    openConversation,
  ])

  const sendMessage = useCallback(async () => {
    const cid = selectedId
    if (cid == null || sending) return
    const text = draft.trim()
    const file = pendingFile
    if (!text && !file) return
    setSending(true)
    try {
      let res: Response
      if (file) {
        const fd = new FormData()
        if (text) fd.set("body", text)
        fd.set("file", file)
        res = await fetch(`/api/messages/conversations/${cid}/messages`, {
          method: "POST",
          body: fd,
        })
      } else {
        res = await fetch(`/api/messages/conversations/${cid}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
        })
      }
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(
          err.error ?? `Mesaj gönderilemedi (${res.status}). Tekrar deneyin.`
        )
        return
      }
      setDraft("")
      setPendingFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      await syncRealtimeForConversation(cid)
      await loadConversations()
    } catch {
      toast.error("Bağlantı hatası. Mesaj gönderilemedi.")
    } finally {
      setSending(false)
    }
  }, [
    draft,
    pendingFile,
    selectedId,
    sending,
    syncRealtimeForConversation,
    loadConversations,
  ])

  const confirmDeleteConversation = useCallback(async () => {
    if (!deleteTarget) return
    const cid = deleteTarget.id
    setDeletingId(cid)
    try {
      const res = await fetch(`/api/messages/conversations/${cid}`, {
        method: "DELETE",
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Sohbet silinemedi.")
        return
      }
      setDeleteTarget(null)
      if (selectedRef.current === cid) {
        setSelectedId(null)
        setMessages([])
        setHasOlder(false)
        setMobileChatOpen(false)
      }
      await loadConversations()
      toast.success("Sohbet silindi.")
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setDeletingId(null)
    }
  }, [deleteTarget, loadConversations])

  const onChatScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const scrollEl = e.currentTarget
      if (
        scrollEl.scrollTop < 72 &&
        hasOlder &&
        !loadingOlderRef.current &&
        !loadingOlder
      ) {
        void loadOlderMessages()
      }
    },
    [hasOlder, loadingOlder, loadOlderMessages]
  )

  const filteredConversations = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => {
      const name = c.other.displayName.toLowerCase()
      const dep = (c.other.departman ?? "").toLowerCase()
      return name.includes(q) || dep.includes(q)
    })
  }, [conversations, listQuery])

  const filteredColleagues = useMemo(() => {
    const others = colleagues.filter((c) => c.id !== currentCalisanId)
    const q = pickerQuery.trim().toLowerCase()
    if (!q) return others
    return others.filter((c) => {
      const name = c.displayName.toLowerCase()
      const dep = (c.departman ?? "").toLowerCase()
      return name.includes(q) || dep.includes(q)
    })
  }, [colleagues, pickerQuery, currentCalisanId])

  const filteredForGroup = useMemo(() => {
    const others = colleagues.filter((c) => c.id !== currentCalisanId)
    const q = groupPickerQuery.trim().toLowerCase()
    if (!q) return others
    return others.filter((c) => {
      const name = c.displayName.toLowerCase()
      const dep = (c.departman ?? "").toLowerCase()
      return name.includes(q) || dep.includes(q)
    })
  }, [colleagues, groupPickerQuery, currentCalisanId])

  const showList = !isMobile || !mobileChatOpen
  const showChatPane = !isMobile || mobileChatOpen

  const canSend = !!(draft.trim() || pendingFile) && !sending

  return (
    <div className="flex h-full min-h-0 max-h-full flex-1 flex-col overflow-hidden px-3 pb-3 pt-0 md:px-5 md:pb-5">
      <div
        className={cn(
          "flex h-full min-h-0 max-h-full flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm",
          "flex-col md:flex-row md:items-stretch"
        )}
      >
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-col border-border md:max-w-[min(100%,420px)] md:w-[360px] md:shrink-0 md:border-r",
            CHAT_LIST_BG,
            isMobile && (showList ? "flex w-full flex-1" : "hidden"),
            !isMobile && "flex"
          )}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              className={cn(
                "flex min-h-12 shrink-0 items-center gap-2 px-2.5 py-2 sm:min-h-[3.25rem] sm:px-3",
                CHAT_HEADER
              )}
            >
              <span className="min-w-0 truncate text-base font-semibold tracking-tight">
                Chats
              </span>
              {realtimeLive && (
                <span className="shrink-0 rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  Live
                </span>
              )}
              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-9 shrink-0 text-white hover:bg-white/10"
                  onClick={() => setGroupDialogOpen(true)}
                  aria-label="Yeni grup"
                >
                  <UsersRound className="size-5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-9 shrink-0 text-white hover:bg-white/10"
                  onClick={() => setPickerOpen(true)}
                  aria-label="New chat"
                >
                  <MessageCirclePlus className="size-5" />
                </Button>
              </div>
            </div>
            <div className="shrink-0 border-b border-border bg-muted/30 px-2.5 py-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                  placeholder="Search or start a new chat"
                  className="h-9 border-0 bg-white pl-9 text-sm shadow-sm"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
              <div className="flex flex-col">
                {loadingList && conversations.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Loading…
                  </p>
                ) : filteredConversations.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm leading-relaxed text-muted-foreground">
                    No chats yet. Start a 1:1 with + or a group with the people
                    icon.
                  </p>
                ) : (
                  filteredConversations.map((c) => {
                    const active = c.id === selectedId
                    return (
                      <div
                        key={c.id}
                        className={cn(
                          "group flex w-full items-stretch gap-1 border-b border-border transition-colors hover:bg-muted/50",
                          active && "bg-muted/60"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => openConversation(c.id)}
                          className="flex min-w-0 flex-1 gap-3 px-3 py-3 text-left"
                        >
                          <Avatar className="size-11 shrink-0 ring-2 ring-background shadow-sm">
                            <AvatarImage
                              src={c.other.avatarUrl ?? undefined}
                              alt=""
                            />
                            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                              {initialsFromDisplayName(c.other.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate font-medium text-foreground">
                                {c.other.displayName}
                              </span>
                              {c.lastMessage && (
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {formatListTime(c.lastMessage.createdAt)}
                                </span>
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {c.other.departman ?? "—"}
                            </p>
                            <p className="mt-0.5 truncate text-sm text-muted-foreground/90">
                              {c.lastMessage
                                ? `${c.lastMessage.fromMe ? "You: " : ""}${previewText(c.lastMessage.body)}`
                                : "No messages"}
                            </p>
                          </div>
                          {c.unreadCount > 0 && (
                            <span className="mt-1 flex size-5 shrink-0 items-center justify-center self-start rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                              {c.unreadCount > 9 ? "9+" : c.unreadCount}
                            </span>
                          )}
                        </button>
                        <div className="flex shrink-0 items-center pr-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-9 text-muted-foreground opacity-80 hover:bg-muted hover:text-destructive hover:opacity-100"
                            aria-label="Sohbeti sil"
                            disabled={deletingId === c.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteTarget(c)
                            }}
                          >
                            {deletingId === c.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:min-h-0",
            isMobile
              ? showChatPane
                ? "flex w-full min-w-0 flex-1"
                : "hidden"
              : "flex min-w-0"
          )}
        >
          {selectedConv ? (
            <>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <div
                className={cn(
                  "flex min-h-12 shrink-0 items-center gap-2 px-2.5 py-2 sm:min-h-[3.25rem] md:px-3",
                  CHAT_HEADER
                )}
              >
                {isMobile && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-9 shrink-0 text-white hover:bg-white/10"
                    onClick={() => setMobileChatOpen(false)}
                    aria-label="Back"
                  >
                    <ArrowLeft className="size-5" />
                  </Button>
                )}
                <button
                  type="button"
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 rounded-md py-0.5 text-left transition-colors",
                    "text-primary-foreground hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
                  )}
                  onClick={() => setChatDetailsOpen(true)}
                  aria-expanded={chatDetailsOpen}
                  aria-haspopup="dialog"
                  aria-label={`${selectedConv.other.displayName} — sohbet detayları`}
                >
                  <Avatar className="size-10 shrink-0 ring-2 ring-white/35 md:size-11">
                    <AvatarImage
                      src={
                        (chatAvatars?.other ??
                          selectedConv.other.avatarUrl) ||
                        undefined
                      }
                      alt=""
                    />
                    <AvatarFallback className="bg-white/20 text-sm font-semibold text-white">
                      {initialsFromDisplayName(selectedConv.other.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight md:text-base">
                      {selectedConv.other.displayName}
                    </p>
                    <p className="truncate text-xs text-white/80">
                      {selectedConv.isGroup
                        ? selectedConv.other.departman ?? "Grup"
                        : selectedConv.other.departman ?? "No department"}
                    </p>
                  </div>
                  <ChevronDown
                    className="size-4 shrink-0 opacity-75"
                    aria-hidden
                  />
                </button>
              </div>

              <div
                ref={scrollRef}
                onScroll={onChatScroll}
                className={cn(
                  "relative min-h-0 flex-1 basis-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 md:px-4",
                  CHAT_THREAD_BG
                )}
              >
                {loadingOlder && (
                  <div className="mb-2 flex justify-center">
                    <span className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      Loading older messages…
                    </span>
                  </div>
                )}
                {loadingMessages && messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    Loading messages…
                  </p>
                ) : (
                  <div className="flex w-full min-w-0 flex-col gap-2">
                    {messages.map((m) => {
                      const otherInit = initialsFromDisplayName(
                        selectedConv.other.displayName
                      )
                      const peerInit =
                        selectedConv.isGroup && m.senderDisplayName
                          ? initialsFromDisplayName(m.senderDisplayName)
                          : otherInit
                      const myInit = initialsFromDisplayName(
                        currentUserName || "Ben"
                      )
                      return (
                      <div key={m.id} className="flex w-full min-w-0 flex-col gap-0.5">
                        {selectedConv.isGroup &&
                          !m.fromMe &&
                          m.senderDisplayName && (
                            <p className="pl-12 text-[11px] font-semibold text-muted-foreground">
                              {m.senderDisplayName}
                            </p>
                          )}
                      <div
                        className={cn(
                          "flex w-full min-w-0 items-end gap-2",
                          m.fromMe ? "justify-end pr-0 pl-4" : "justify-start pr-4 pl-0"
                        )}
                      >
                        {!m.fromMe && (
                          <Avatar className="size-8 shrink-0 ring-2 ring-border/70">
                            <AvatarImage
                              src={
                                (chatAvatars?.other ??
                                  selectedConv.other.avatarUrl) ||
                                undefined
                              }
                              alt=""
                            />
                            <AvatarFallback className="bg-muted text-[10px] font-semibold">
                              {peerInit}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={cn(
                            "relative max-w-[min(100%,30rem)] rounded-xl px-3 py-2",
                            m.fromMe ? BUBBLE_OUT : BUBBLE_IN
                          )}
                        >
                          {m.attachment &&
                          (m.attachment.mime ?? "").startsWith("image/") ? (
                            <a
                              href={m.attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mb-1 block"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={m.attachment.url}
                                alt={m.attachment.fileName}
                                className="max-h-52 max-w-full rounded-md object-cover"
                              />
                            </a>
                          ) : m.attachment ? (
                            <a
                              href={m.attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mb-1 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-2 text-sm text-foreground underline-offset-2 hover:underline"
                            >
                              <FileText className="size-8 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">
                                  {m.attachment.fileName}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatFileSize(m.attachment.size)}
                                </span>
                              </span>
                            </a>
                          ) : null}
                          {m.body ? (
                            <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                              {m.body}
                            </p>
                          ) : null}
                          <div
                            className={cn(
                              "mt-1 flex items-center justify-end gap-1.5 text-right text-muted-foreground"
                            )}
                          >
                            <span className="tabular-nums text-[11px]">
                              {formatTimeOnlyIstanbul(m.createdAt).slice(0, 5)}
                            </span>
                            {m.fromMe && (
                              <span
                                className="inline-flex shrink-0 items-center"
                                title={
                                  (m.seenBy?.length ?? 0) > 0
                                    ? `Görüldü: ${(m.seenBy ?? []).map((s) => s.displayName).join(", ")}`
                                    : "İletildi"
                                }
                              >
                                {(m.seenBy?.length ?? 0) > 0 ? (
                                  <BadgeCheck
                                    className="size-3.5 text-primary"
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                ) : (
                                  <Check
                                    className="size-3.5 text-muted-foreground/55"
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                )}
                                <span className="sr-only">
                                  {(m.seenBy?.length ?? 0) > 0 ? "Görüldü" : "İletildi"}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                        {m.fromMe && (
                          <Avatar className="size-8 shrink-0 ring-2 ring-primary/25">
                            <AvatarImage
                              src={
                                (chatAvatars?.my ??
                                  currentUserAvatarUrl) ||
                                undefined
                              }
                              alt=""
                            />
                            <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
                              {myInit}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                      {m.fromMe && (m.seenBy?.length ?? 0) > 0 ? (
                        <p
                          className={cn(
                            "max-w-[min(100%,30rem)] text-[10px] leading-snug text-muted-foreground",
                            "self-end pr-10 text-right"
                          )}
                          title={(m.seenBy ?? [])
                            .map((s) => s.displayName)
                            .join(", ")}
                        >
                          <span className="font-medium text-foreground/70">
                            Görüldü:{" "}
                          </span>
                          {formatSeenByLabel(m.seenBy ?? [])}
                        </p>
                      ) : null}
                      </div>
                    )
                  })}
                  </div>
                )}
              </div>

              <div
                className={cn(
                  "relative z-10 shrink-0 px-3 py-2 md:px-4 md:py-3",
                  CHAT_COMPOSER
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.txt,.zip,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    setPendingFile(f ?? null)
                  }}
                />
                {pendingFile && (
                  <div className="mb-2 flex w-full min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {pendingFile.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs"
                      onClick={() => {
                        setPendingFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ""
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
                <div className="flex w-full min-w-0 items-end gap-2">
                  <Button
                    type="button"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach file"
                  >
                    <Paperclip className="size-5" />
                  </Button>
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" || e.shiftKey) return
                      if (e.nativeEvent.isComposing) return
                      e.preventDefault()
                      void sendMessage()
                    }}
                    placeholder="Type a message"
                    title="Enter: gönder · Shift+Enter: yeni satır"
                    rows={1}
                    className="max-h-32 min-h-[42px] flex-1 resize-none border-border bg-background text-sm shadow-sm"
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="size-10 shrink-0 rounded-full"
                    disabled={!canSend}
                    onClick={() => void sendMessage()}
                    aria-label="Send"
                  >
                    <SendHorizontal className="size-5" />
                  </Button>
                </div>
              </div>
            </div>

              <Sheet open={chatDetailsOpen} onOpenChange={setChatDetailsOpen}>
                <SheetContent
                  side="right"
                  className="flex h-full max-h-[100dvh] w-full max-w-sm flex-col gap-0 overflow-hidden border-l p-0 sm:max-w-sm [&>button]:text-foreground"
                >
                  <SheetHeader className="shrink-0 space-y-1 border-b border-border bg-muted/25 px-4 py-4 text-left sm:pr-12">
                    <SheetTitle className="text-base">
                      {selectedConv.other.displayName}
                    </SheetTitle>
                    <SheetDescription className="text-xs">
                      {selectedConv.isGroup
                        ? `${selectedConv.other.departman ?? "Grup sohbeti"} · üyeler ve ekler`
                        : `${selectedConv.other.departman ?? "Bire bir"} · kişi ve ekler`}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
                    <section className="space-y-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        <UsersRound className="size-3.5 shrink-0" aria-hidden />
                        {selectedConv.isGroup
                          ? `Üyeler (${displayMembers.length || (loadingMessages ? "…" : 0)})`
                          : "Kişi"}
                      </div>
                      {displayMembers.length === 0 &&
                      selectedConv.isGroup &&
                      loadingMessages ? (
                        <p className="text-xs text-muted-foreground">
                          Üyeler yükleniyor…
                        </p>
                      ) : displayMembers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Üye bilgisi yok.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-3">
                          {displayMembers.map((mem) => (
                            <li
                              key={mem.id}
                              className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2"
                            >
                              <Avatar className="size-9 shrink-0 ring-1 ring-border/60">
                                <AvatarImage
                                  src={mem.avatarUrl ?? undefined}
                                  alt=""
                                />
                                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                                  {initialsFromDisplayName(mem.displayName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {mem.displayName}
                                </p>
                                {mem.departman ? (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {mem.departman}
                                  </p>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <section className="mt-6 space-y-3 border-t border-border pt-5">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        <Paperclip className="size-3.5 shrink-0" aria-hidden />
                        Ekler ({attachmentHistory.length})
                      </div>
                      {attachmentHistory.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Bu sohbette henüz ek yok.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {attachmentHistory.map(({ id, attachment: att }) => {
                            const isImg = (att.mime ?? "").startsWith(
                              "image/"
                            )
                            return (
                              <a
                                key={id}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex max-w-[9.5rem] shrink-0 flex-col gap-1 rounded-md border border-border bg-muted/30 px-2 py-2 text-foreground transition-colors hover:bg-muted/60"
                              >
                                {isImg ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={att.url}
                                    alt=""
                                    className="h-14 w-full rounded object-cover"
                                  />
                                ) : (
                                  <FileText className="mx-auto size-7 text-muted-foreground" />
                                )}
                                <span className="line-clamp-2 text-center text-[10px] leading-tight">
                                  {att.fileName}
                                </span>
                              </a>
                            )
                          })}
                        </div>
                      )}
                    </section>
                  </div>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden px-6 text-center",
                CHAT_THREAD_BG
              )}
            >
              <div className="rounded-full border border-border bg-card p-6 shadow-sm">
                <MessageCirclePlus className="size-14 text-primary" />
              </div>
              <p className="max-w-sm text-lg font-light text-foreground">
                Team messaging
              </p>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                Select a chat on the left or start a new one with +. Scroll up to
                load older messages, or attach a file with the paperclip. With
                Supabase Realtime configured, updates appear instantly; otherwise
                the list refreshes every few seconds.
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.isGroup ? "Grubu sil?" : "Sohbeti sil?"}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.isGroup ? (
                <>
                  <span className="font-medium text-foreground">
                    {deleteTarget.other.displayName}
                  </span>{" "}
                  grubu ve tüm mesajlar kalıcı olarak silinir. Üyelerin
                  listesinde de görünmez.
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">
                    {deleteTarget?.other.displayName}
                  </span>{" "}
                  ile olan bu sohbet ve tüm mesajlar kalıcı olarak silinir. Karşı
                  tarafta da görünmez.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deletingId != null}
            >
              İptal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingId != null}
              onClick={() => void confirmDeleteConversation()}
            >
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[85vh] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New chat</DialogTitle>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Search by name or department…"
              className="pl-9"
            />
          </div>
          {/* Native scroll: Radix ScrollArea inside Dialog often eats the first
              click (focuses viewport only). */}
          <div className="max-h-[min(360px,50vh)] overflow-y-auto overflow-x-hidden pr-1 [-webkit-overflow-scrolling:touch]">
            <div className="flex flex-col gap-1">
              {filteredColleagues.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No results
                </p>
              ) : (
                filteredColleagues.map((c) => {
                  const busy = startingChatWithId === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={startingChatWithId != null}
                      className="rounded-lg border border-transparent px-3 py-3 text-left transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-60"
                      onClick={() => void startWithColleague(c.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10 shrink-0 ring-2 ring-border">
                          <AvatarImage src={c.avatarUrl ?? undefined} alt="" />
                          <AvatarFallback className="bg-muted text-xs font-semibold">
                            {initialsFromDisplayName(c.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground">
                              {c.displayName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {c.departman ?? "—"}
                            </p>
                          </div>
                          {busy && (
                            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={groupDialogOpen}
        onOpenChange={(open) => {
          setGroupDialogOpen(open)
          if (!open) {
            setGroupTitle("")
            setGroupMemberIds([])
            setGroupPickerQuery("")
          }
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni grup</DialogTitle>
            <DialogDescription>
              Gruba bir ad verin ve katılmasını istediğiniz kişileri işaretleyin
              (en fazla 200 kişi).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="group-title">Grup adı</Label>
              <Input
                id="group-title"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="Örn. Kalite ekibi"
                className="mt-1.5"
                maxLength={200}
              />
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={groupPickerQuery}
                onChange={(e) => setGroupPickerQuery(e.target.value)}
                placeholder="İsim veya departman ile ara…"
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Seçili: {groupMemberIds.length} kişi (kendiniz otomatik dahil)
            </p>
            <div className="max-h-[min(280px,40vh)] overflow-y-auto overflow-x-hidden pr-1 [-webkit-overflow-scrolling:touch]">
              <div className="flex flex-col gap-1">
                {filteredForGroup.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Sonuç yok
                  </p>
                ) : (
                  filteredForGroup.map((c) => {
                    const checked = groupMemberIds.includes(c.id)
                    return (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:bg-muted"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => {
                            setGroupMemberIds((prev) =>
                              prev.includes(c.id)
                                ? prev.filter((x) => x !== c.id)
                                : [...prev, c.id]
                            )
                          }}
                          aria-label={c.displayName}
                        />
                        <Avatar className="size-9 shrink-0 ring-2 ring-border">
                          <AvatarImage src={c.avatarUrl ?? undefined} alt="" />
                          <AvatarFallback className="bg-muted text-xs font-semibold">
                            {initialsFromDisplayName(c.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">
                            {c.displayName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {c.departman ?? "—"}
                          </p>
                        </div>
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setGroupDialogOpen(false)}
              disabled={creatingGroup}
            >
              İptal
            </Button>
            <Button
              type="button"
              disabled={
                creatingGroup ||
                groupTitle.trim().length < 1 ||
                groupMemberIds.length < 1
              }
              onClick={() => void createGroup()}
            >
              {creatingGroup ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Oluşturuluyor…
                </>
              ) : (
                "Grubu oluştur"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
