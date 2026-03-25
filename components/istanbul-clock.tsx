"use client"

import { useEffect, useState } from "react"
import { APP_LOCALE, APP_TIMEZONE } from "@/lib/date-format"

export function IstanbulClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const line1 = new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now)

  const line2 = new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now)

  return (
    <div className="hidden sm:flex flex-col items-end text-right leading-tight mr-2 border-r border-border pr-3">
      <span className="text-[11px] text-muted-foreground capitalize">{line1}</span>
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {line2} <span className="text-[10px] font-normal text-muted-foreground">(İstanbul)</span>
      </span>
    </div>
  )
}
