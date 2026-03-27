"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { useDmInboxRealtime } from "@/hooks/use-dm-inbox-realtime"

const POLL_MS = 20000

export type DmInboxConvSnippet = {
  id: number
  unreadCount: number
  updatedAt: string
  other: { displayName: string }
}

type DmInboxContextValue = {
  unreadConversations: DmInboxConvSnippet[]
  hasUnread: boolean
}

const DmInboxContext = React.createContext<DmInboxContextValue | null>(null)

async function fetchSessionCalisanId(): Promise<number | null> {
  try {
    const res = await fetch("/api/auth/session", { credentials: "include" })
    if (!res.ok) return null
    const data = (await res.json()) as { user?: { id?: string } }
    const id = Number.parseInt(data.user?.id ?? "", 10)
    return Number.isFinite(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

export function DmInboxProvider({ children }: { children: React.ReactNode }) {
  const [calisanId, setCalisanId] = useState<number | null>(null)
  const [allConversations, setAllConversations] = useState<DmInboxConvSnippet[]>(
    []
  )

  const load = useCallback(async () => {
    const res = await fetch("/api/messages/conversations", {
      credentials: "include",
    })
    if (res.status === 401) {
      setAllConversations([])
      return
    }
    if (!res.ok) return
    const data = await res.json()
    const all = (data.conversations ?? []) as DmInboxConvSnippet[]
    setAllConversations(all)
  }, [])

  useEffect(() => {
    void fetchSessionCalisanId().then(setCalisanId)
  }, [])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(t)
  }, [load])

  const onRealtime = useCallback(() => {
    void load()
  }, [load])

  useDmInboxRealtime(calisanId, onRealtime, undefined)

  const unreadConversations = useMemo(
    () =>
      allConversations
        .filter((c) => c.unreadCount > 0)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ),
    [allConversations]
  )

  const value = useMemo<DmInboxContextValue>(
    () => ({
      unreadConversations,
      hasUnread: unreadConversations.length > 0,
    }),
    [unreadConversations]
  )

  return (
    <DmInboxContext.Provider value={value}>{children}</DmInboxContext.Provider>
  )
}

export function useDmInbox(): DmInboxContextValue {
  const ctx = React.useContext(DmInboxContext)
  if (!ctx) {
    throw new Error("useDmInbox must be used within DmInboxProvider")
  }
  return ctx
}
