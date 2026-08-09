"use client"

import * as React from "react"
import Link from "next/link"
import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const POLL_MS = 120_000

type ShgmNotificationItem = { id: number; title: string; categoryLabel: string }

async function fetchUnread(): Promise<{ count: number; items: ShgmNotificationItem[] }> {
  try {
    const res = await fetch("/api/shgm-mevzuat/unread-count", { cache: "no-store" })
    if (!res.ok) return { count: 0, items: [] }
    const data = (await res.json()) as { count?: number; items?: ShgmNotificationItem[] }
    return { count: data.count ?? 0, items: Array.isArray(data.items) ? data.items : [] }
  } catch {
    return { count: 0, items: [] }
  }
}

/** Başlıktaki SHGM Mevzuat zil göstergesi — yalnızca izni olan kullanıcılara (API sessizce 0 döner). */
export function ShgmHeaderNotifications() {
  const [count, setCount] = React.useState(0)
  const [items, setItems] = React.useState<ShgmNotificationItem[]>([])
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      const data = await fetchUnread()
      if (!cancelled) {
        setCount(data.count)
        setItems(data.items)
      }
    }
    void load()
    const t = window.setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [])

  if (count === 0) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative size-8 shrink-0"
          aria-label={`${count} yeni SHGM mevzuatı`}
          title="SHGM Mevzuat bildirimleri"
        >
          <Bell className="size-4" />
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1",
              "bg-destructive text-[10px] font-bold leading-none text-destructive-foreground"
            )}
          >
            {count > 99 ? "99+" : count}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-semibold">SHGM Mevzuat — Yeni</p>
          <p className="text-muted-foreground text-xs">{count} kayıt inceleme bekliyor</p>
        </div>
        <ul className="max-h-72 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="border-b last:border-b-0">
              <Link
                href={`/compliance/shgm-mevzuat/${item.id}`}
                onClick={() => setOpen(false)}
                className="hover:bg-muted/60 block px-3 py-2 text-sm"
              >
                <p className="line-clamp-2 font-medium">{item.title}</p>
                <p className="text-muted-foreground text-xs">{item.categoryLabel}</p>
              </Link>
            </li>
          ))}
        </ul>
        <div className="p-2">
          <Link
            href="/compliance/shgm-mevzuat"
            onClick={() => setOpen(false)}
            className="text-primary block rounded-md px-2 py-1.5 text-center text-xs font-medium hover:underline"
          >
            Tümünü gör
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
