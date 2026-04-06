"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useDmInboxRealtime } from "@/hooks/use-dm-inbox-realtime"

/** Sekme görünürken yedek yoklama (Realtime varsa bile ağ yükünü düşük tutar). */
const POLL_MS_VISIBLE = 90_000
/** Realtime tetiklerini tek istekte birleştir */
const REALTIME_DEBOUNCE_MS = 1_200

export type DmInboxConvSnippet = {
  id: number
  unreadCount: number
  updatedAt: string
  other: { displayName: string; avatarUrl?: string | null }
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

  const loadInFlight = useRef(false)

  const load = useCallback(async () => {
    if (loadInFlight.current) return
    loadInFlight.current = true
    try {
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
    } finally {
      loadInFlight.current = false
    }
  }, [])

  useEffect(() => {
    void fetchSessionCalisanId().then(setCalisanId)
  }, [])

  useEffect(() => {
    let intervalId: number | undefined

    const pollIfVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return
      }
      void load()
    }

    void pollIfVisible()

    const armInterval = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId)
        intervalId = undefined
      }
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return
      }
      intervalId = window.setInterval(pollIfVisible, POLL_MS_VISIBLE)
    }

    armInterval()

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void load()
        armInterval()
      } else if (intervalId !== undefined) {
        window.clearInterval(intervalId)
        intervalId = undefined
      }
    }

    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      if (intervalId !== undefined) window.clearInterval(intervalId)
    }
  }, [load])

  const realtimeDebounce = useRef<number | null>(null)

  const onRealtime = useCallback(() => {
    if (realtimeDebounce.current !== null) {
      window.clearTimeout(realtimeDebounce.current)
    }
    realtimeDebounce.current = window.setTimeout(() => {
      realtimeDebounce.current = null
      void load()
    }, REALTIME_DEBOUNCE_MS)
  }, [load])

  useEffect(() => {
    return () => {
      if (realtimeDebounce.current !== null) {
        window.clearTimeout(realtimeDebounce.current)
      }
    }
  }, [])

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
