"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Users, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type AssigneePersonOption = { id: number; label: string; sublabel?: string }
export type AssigneeGroupOption = { id: number; label: string; memberCount?: number }
export type AssigneeValue = { type: "person"; id: number } | { type: "group"; id: number } | null

/**
 * Person/Group sectioned tek-seçim atama picker'ı — Finding'in "Responsible Person / Group"
 * alanı için. Manage Audit, Audit Plan ve Finding Detail'deki Add Finding/Edit dialoglarının
 * ÜÇÜ DE bu TEK component'i reuse eder (paralel/ayrı ayrı picker YOK). EmployeeCombobox'la aynı
 * arama/klavye deseninin People+Groups bölümlü hali.
 */
export function AssigneeCombobox({
  people,
  groups,
  value,
  onChange,
  placeholder = "Kişi veya grup seçin…",
  searchPlaceholder = "Ara…",
  id,
  disabled,
}: {
  people: AssigneePersonOption[]
  groups: AssigneeGroupOption[]
  value: AssigneeValue
  onChange: (value: AssigneeValue) => void
  placeholder?: string
  searchPlaceholder?: string
  id?: string
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")

  const selectedPerson = value?.type === "person" ? people.find((p) => p.id === value.id) : undefined
  const selectedGroup = value?.type === "group" ? groups.find((g) => g.id === value.id) : undefined
  const selectedLabel = selectedPerson
    ? `${selectedPerson.label}${selectedPerson.sublabel ? ` — ${selectedPerson.sublabel}` : ""}`
    : selectedGroup
      ? selectedGroup.label
      : null

  const norm = (s: string) => s.trim().toLocaleLowerCase("tr-TR")

  const filteredPeople = React.useMemo(() => {
    const n = norm(q)
    if (!n) return people
    return people.filter((p) => `${p.label} ${p.sublabel ?? ""}`.toLocaleLowerCase("tr-TR").includes(n))
  }, [people, q])

  const filteredGroups = React.useMemo(() => {
    const n = norm(q)
    if (!n) return groups
    return groups.filter((g) => g.label.toLocaleLowerCase("tr-TR").includes(n))
  }, [groups, q])

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
            !selectedLabel && "text-muted-foreground"
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {selectedGroup && <Users className="size-3.5 shrink-0" />}
            {selectedLabel ?? placeholder}
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
          <div
            className="max-h-[min(320px,50vh)] overflow-y-auto overscroll-contain"
            onWheel={(e) => {
              e.currentTarget.scrollTop += e.deltaY
            }}
          >
            <div className="flex flex-col p-1">
              {filteredPeople.length === 0 && filteredGroups.length === 0 ? (
                <p className="text-muted-foreground px-2 py-6 text-center text-sm">Sonuç yok.</p>
              ) : (
                <>
                  {filteredGroups.length > 0 && (
                    <>
                      <p className="text-muted-foreground flex items-center gap-1 px-2 pt-1.5 pb-1 text-xs font-semibold uppercase tracking-wide">
                        <Users className="size-3" /> Groups
                      </p>
                      {filteredGroups.map((g) => (
                        <button
                          key={`group-${g.id}`}
                          type="button"
                          className={cn(
                            "hover:bg-muted flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                            value?.type === "group" && value.id === g.id && "bg-muted"
                          )}
                          onClick={() => {
                            onChange({ type: "group", id: g.id })
                            setOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "size-4 shrink-0",
                              value?.type === "group" && value.id === g.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate leading-snug">{g.label}</span>
                          {typeof g.memberCount === "number" && (
                            <span className="text-muted-foreground shrink-0 text-xs">{g.memberCount} üye</span>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                  {filteredPeople.length > 0 && (
                    <>
                      <p className="text-muted-foreground flex items-center gap-1 px-2 pt-2.5 pb-1 text-xs font-semibold uppercase tracking-wide">
                        <User className="size-3" /> People
                      </p>
                      {filteredPeople.map((p) => (
                        <button
                          key={`person-${p.id}`}
                          type="button"
                          className={cn(
                            "hover:bg-muted flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                            value?.type === "person" && value.id === p.id && "bg-muted"
                          )}
                          onClick={() => {
                            onChange({ type: "person", id: p.id })
                            setOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "size-4 shrink-0",
                              value?.type === "person" && value.id === p.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="min-w-0 leading-snug">
                            {p.label}
                            {p.sublabel ? <span className="text-muted-foreground"> — {p.sublabel}</span> : null}
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          {value && (
            <div className="border-t p-1">
              <button
                type="button"
                className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center justify-center rounded-sm px-2 py-1.5 text-xs"
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                Atamayı kaldır
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
