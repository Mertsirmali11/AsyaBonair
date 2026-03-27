"use client"

import Link from "next/link"
import { MessageSquareText } from "lucide-react"

import { useDmInbox } from "@/components/dm-inbox-provider"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const MAX_BADGES = 6

export function DmHeaderInbox() {
  const { unreadConversations: rows } = useDmInbox()

  if (rows.length === 0) return null

  const shown = rows.slice(0, MAX_BADGES)
  const extra = rows.length - shown.length

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="flex max-w-[min(100vw-12rem,280px)] flex-wrap items-center justify-end gap-1 sm:max-w-none sm:flex-nowrap"
        aria-label="Okunmamış mesajlar"
      >
        <MessageSquareText
          className="size-4 shrink-0 text-muted-foreground sm:hidden"
          aria-hidden
        />
        {shown.map((c, i) => (
          <Tooltip key={c.id}>
            <TooltipTrigger asChild>
              <Link
                href={`/messages?c=${c.id}`}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/30",
                  "bg-primary text-[11px] font-bold text-primary-foreground shadow-sm",
                  "transition-opacity hover:opacity-90 active:opacity-80"
                )}
                title={c.other.displayName}
              >
                {i + 1}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="font-medium">{c.other.displayName}</p>
              <p className="text-muted-foreground text-xs">
                {c.unreadCount} okunmamış
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
        {extra > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/messages"
                className={cn(
                  "flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full border border-border px-1.5",
                  "bg-muted text-[11px] font-semibold text-foreground",
                  "hover:bg-muted/80"
                )}
              >
                +{extra}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {extra} sohbet daha — Mesajlar
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
