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

export type EmployeeOption = { id: number; label: string; sublabel?: string }

/** Aranabilir tek-seçim personel açılır listesi — çok sayıda çalışanda kaydırma yerine arama sağlar. */
export function EmployeeCombobox({
  options,
  value,
  onChange,
  placeholder = "Personel seçin…",
  searchPlaceholder = "Ara…",
  id,
  disabled,
}: {
  options: EmployeeOption[]
  value: number | undefined
  onChange: (id: number) => void
  placeholder?: string
  searchPlaceholder?: string
  id?: string
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")

  const selected = options.find((o) => o.id === value)

  const filtered = React.useMemo(() => {
    const n = q.trim().toLocaleLowerCase("tr-TR")
    if (!n) return options
    return options.filter((o) =>
      `${o.label} ${o.sublabel ?? ""}`.toLocaleLowerCase("tr-TR").includes(n)
    )
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
          <span className="truncate">
            {selected ? `${selected.label}${selected.sublabel ? ` — ${selected.sublabel}` : ""}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex flex-col gap-0">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="rounded-b-none border-0 border-b shadow-none focus-visible:ring-0"
            autoFocus
          />
          {/* Native overflow scroll + manuel onWheel: bu bileşen bir Dialog içinde açıldığında
              Dialog'un scroll-lock'u (react-remove-scroll) global wheel event'ini preventDefault
              ediyor; scrollTop'u elle güncelleyerek fare tekerleği kaydırmasını garantiye alıyoruz. */}
          <div
            className="max-h-[min(260px,45vh)] overflow-y-auto overscroll-contain"
            onWheel={(e) => {
              e.currentTarget.scrollTop += e.deltaY
            }}
          >
            <div className="flex flex-col p-1">
              {filtered.length === 0 ? (
                <p className="text-muted-foreground px-2 py-6 text-center text-sm">Sonuç yok.</p>
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
                      className={cn("size-4 shrink-0", value === opt.id ? "opacity-100" : "opacity-0")}
                    />
                    <span className="min-w-0 leading-snug">
                      {opt.label}
                      {opt.sublabel ? (
                        <span className="text-muted-foreground"> — {opt.sublabel}</span>
                      ) : null}
                    </span>
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
