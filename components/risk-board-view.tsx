"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  ArrowLeft,
  Info,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type RiskStatusTone = "awaiting" | "mitigation" | "monitored"

type RiskRow = {
  id: string
  riskNo: string
  date: string
  title: string
  titleDot?: "amber" | "red" | "green" | null
  initial: string
  final: string
  field: string
  threads: string
  threadsHighlight?: boolean
  status: string
  statusTone: RiskStatusTone
}

const MOCK_RISKS: RiskRow[] = [
  {
    id: "1",
    riskNo: "BON-SR-1620",
    date: "2026-03-11",
    title: "test2",
    titleDot: "amber",
    initial: "Not Determined",
    final: "Not Determined",
    field: "Aircraft Audit",
    threads: "No special actions required",
    status: "Awaiting Assessment",
    statusTone: "awaiting",
  },
  {
    id: "2",
    riskNo: "BON-SR-1621",
    date: "2026-03-10",
    title: "Wings System Error (Experience Logbooks)",
    titleDot: "red",
    initial: "2C",
    final: "2C",
    field: "Flight Operation Dept",
    threads: "No special actions required",
    status: "Awaiting Mitigation",
    statusTone: "mitigation",
  },
  {
    id: "3",
    riskNo: "BON-SR-1618",
    date: "2026-03-09",
    title: "TC-IHY Right Flap Trailing Edge Damage",
    titleDot: "green",
    initial: "3C",
    final: "1E",
    field: "Performance / EFB",
    threads: "Needs Assessment",
    threadsHighlight: true,
    status: "To be Monitored",
    statusTone: "monitored",
  },
  {
    id: "4",
    riskNo: "BON-SR-1615",
    date: "2026-03-08",
    title: "Tools not returned on time or left uncontrolled",
    initial: "4C",
    final: "2D",
    field: "Maintenance",
    threads: "No special actions required",
    status: "Awaiting Assessment",
    statusTone: "awaiting",
  },
]

function statusBadgeClass(tone: RiskStatusTone) {
  switch (tone) {
    case "awaiting":
      return "border-sky-200 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100"
    case "mitigation":
      return "border-sky-300 bg-sky-200 text-sky-950 dark:border-sky-700 dark:bg-sky-900/60 dark:text-sky-50"
    case "monitored":
      return "border-slate-600 bg-slate-700 text-white dark:bg-slate-800 dark:text-white"
    default:
      return ""
  }
}

function taskBoardHref(title: string) {
  const q = new URLSearchParams()
  q.set("title", title)
  return `/safety/task-board?${q.toString()}`
}

export function RiskBoardView() {
  const [risks, setRisks] = useState<RiskRow[]>(() =>
    MOCK_RISKS.map((r) => ({ ...r }))
  )
  const [keyword, setKeyword] = useState("")

  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState("")

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return risks
    return risks.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.riskNo.toLowerCase().includes(q) ||
        r.field.toLowerCase().includes(q)
    )
  }, [keyword, risks])

  const openEditTitle = (row: RiskRow) => {
    setEditingId(row.id)
    setTitleDraft(row.title)
    setEditOpen(true)
  }

  const saveTitle = () => {
    if (!editingId) return
    const next = titleDraft.trim()
    if (!next) return
    setRisks((prev) =>
      prev.map((r) => (r.id === editingId ? { ...r, title: next } : r))
    )
    setEditOpen(false)
    setEditingId(null)
    setTitleDraft("")
  }

  const removeRisk = (id: string) => {
    if (
      !window.confirm(
        "Remove this risk from the list? This only affects your current session (demo)."
      )
    ) {
      return
    }
    setRisks((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-muted/20 p-4 md:p-6">
      <Button type="button" variant="outline" size="sm" className="w-fit">
        Advanced filtering
      </Button>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" className="size-9 shrink-0" asChild>
          <Link href="/dashboard" aria-label="Back to dashboard">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          Risk Board
          <button
            type="button"
            className="text-sky-600 hover:text-sky-700 dark:text-sky-400"
            aria-label="Information"
          >
            <Info className="size-5" />
          </button>
        </h1>
      </div>

      <Input
        placeholder="Type keywords to filter…"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        className="max-w-xl bg-background"
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-muted/60 hover:bg-muted/60">
              <TableHead className="w-10 px-2" />
              <TableHead>Risk No</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Initial Assessment</TableHead>
              <TableHead>Final Assessment</TableHead>
              <TableHead>Field</TableHead>
              <TableHead className="min-w-[180px]">
                Threads &amp; Consequences &amp; Mitigations
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground h-24 text-center">
                  No risks match your filter.
                </TableCell>
              </TableRow>
            ) : null}
            {filtered.map((row) => (
              <TableRow key={row.id} className="bg-background hover:bg-muted/30">
                <TableCell className="px-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        aria-label={`Actions for ${row.riskNo}`}
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuItem asChild>
                        <Link href={taskBoardHref(row.title)}>Open task board</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openEditTitle(row)}>
                        <Pencil className="size-4" />
                        Edit title
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => removeRisk(row.id)}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs">
                  {row.riskNo}
                </TableCell>
                <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                <TableCell className="max-w-[220px]">
                  <span className="flex items-start gap-2">
                    {row.titleDot ? (
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          row.titleDot === "amber" && "bg-amber-500",
                          row.titleDot === "red" && "bg-red-500",
                          row.titleDot === "green" && "bg-emerald-500"
                        )}
                        aria-hidden
                      />
                    ) : null}
                    <span className="whitespace-normal font-medium">{row.title}</span>
                  </span>
                </TableCell>
                <TableCell>{row.initial}</TableCell>
                <TableCell>{row.final}</TableCell>
                <TableCell className="max-w-[140px] whitespace-normal text-sm">
                  {row.field}
                </TableCell>
                <TableCell
                  className={cn(
                    "max-w-[200px] whitespace-normal text-sm",
                    row.threadsHighlight && "font-medium text-amber-700 dark:text-amber-400"
                  )}
                >
                  {row.threads}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      statusBadgeClass(row.statusTone)
                    )}
                  >
                    {row.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditingId(null)
            setTitleDraft("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit title</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="risk-title-edit">Title</Label>
            <Input
              id="risk-title-edit"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              placeholder="Risk title"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditOpen(false)
                setEditingId(null)
                setTitleDraft("")
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveTitle}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
