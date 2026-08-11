"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function AuditCategoryCombobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  id,
  disabled,
}: {
  options: { id: number; name: string }[]
  value: number | undefined
  onChange: (id: number | undefined) => void
  placeholder?: string
  id?: string
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")

  const selected = options.find((o) => o.id === value)

  const filtered = React.useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return options
    return options.filter((o) => o.name.toLowerCase().includes(n))
  }, [options, q])

  React.useEffect(() => {
    if (!open) setQ("")
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-expanded={open}
          className={cn(
            "border-input h-9 w-full justify-between px-3 font-normal shadow-xs",
            !selected && "text-muted-foreground"
          )}
        >
          <span className="truncate">{selected?.name ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <div className="flex flex-col gap-0">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="rounded-b-none border-0 border-b shadow-none focus-visible:ring-0"
            autoFocus
          />
          {/* Native overflow scroll — Radix ScrollArea + Popover içinde fare tekerleği
              kaydırması güvenilir çalışmıyordu; klavye navigasyonu ve scrollbar korunur. */}
          <div className="max-h-[min(260px,45vh)] overflow-y-auto overscroll-contain">
            <div className="flex flex-col p-1">
              {filtered.length === 0 ? (
                <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                  No match.
                </p>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={cn(
                      "hover:bg-muted flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                      value === opt.id && "bg-muted"
                    )}
                    onClick={() => {
                      onChange(opt.id)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        value === opt.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="leading-snug">{opt.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
