import "server-only"

import { createClient } from "@supabase/supabase-js"

/**
 * Supabase Realtime Broadcast: her çalışanın `dm:inbox:{id}` kanalına bildirim.
 * Dashboard’da Realtime’ın açık olduğundan emin olun. Anon key ile istemci dinler.
 */
export async function broadcastDmInbox(
  calisanId: number,
  conversationId: number
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const channel = supabase.channel(`dm:inbox:${calisanId}`, {
    config: { broadcast: { self: true } },
  })

  await new Promise<void>((resolve) => {
    let settled = false
    let timeout: ReturnType<typeof setTimeout>

    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      void supabase.removeChannel(channel)
      resolve()
    }

    timeout = setTimeout(() => finish(), 5000)

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel
          .send({
            type: "broadcast",
            event: "update",
            payload: { conversationId },
          })
          .finally(() => finish())
        return
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        finish()
      }
    })
  })
}

export async function broadcastDmInboxBoth(
  conversationId: number,
  lowerUserId: number,
  higherUserId: number
): Promise<void> {
  await Promise.all([
    broadcastDmInbox(lowerUserId, conversationId),
    broadcastDmInbox(higherUserId, conversationId),
  ])
}
