"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@supabase/supabase-js"

/**
 * Supabase Realtime Broadcast: `dm:inbox:{calisanId}` kanalını dinler.
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` yoksa no-op (yoklama devam eder).
 */
export function useDmInboxRealtime(
  calisanId: number | null,
  onUpdate: (conversationId?: number) => void,
  onChannelStatus?: (subscribed: boolean) => void
) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate
  const onStatusRef = useRef(onChannelStatus)
  onStatusRef.current = onChannelStatus

  useEffect(() => {
    if (calisanId == null) {
      onStatusRef.current?.(false)
      return undefined
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      onStatusRef.current?.(false)
      return undefined
    }

    const supabase = createClient(url, key)
    const channel = supabase.channel(`dm:inbox:${calisanId}`)

    channel.on(
      "broadcast",
      { event: "update" },
      (payload: { payload?: { conversationId?: number } }) => {
        onUpdateRef.current(payload.payload?.conversationId)
      }
    )

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") onStatusRef.current?.(true)
      else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        onStatusRef.current?.(false)
      }
    })

    return () => {
      onStatusRef.current?.(false)
      void supabase.removeChannel(channel)
    }
  }, [calisanId])
}
