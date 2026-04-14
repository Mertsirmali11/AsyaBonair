"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  ChevronDown,
  Info,
  MoreVertical,
  Pencil,
  Plus,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

import {
  firstAssessmentCellClass,
  formatRiskAssessmentWithBand,
  parseRiskLevelCode,
  riskMatrixToneFromSelection,
} from "@/lib/safety-risk-matrix"
import { riskBoardKeyFromTitle } from "@/lib/safety-risk-board-key"
import { type RiskBoardSeedRow, type RiskStatusTone } from "@/lib/safety-risk-seed"
import {
  assessmentCodeFromParts,
  readLocalRiskBoardAssessment,
} from "@/lib/safety-task-board-local-read"
import { cn } from "@/lib/utils"

type RiskRow = RiskBoardSeedRow

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

type BoardSummary = {
  riskKey: string
  riskTitle: string
  probability: number | null
  severity: string | null
}

/**
 * Radix DropdownMenu SSR + hydration sırasında farklı `useId` üretebiliyor.
 * İlk paint’te düz buton; mount sonrası menü — sunucu ve istemci HTML’i eşleşir.
 */
function RiskBoardNewRiskDropdown({
  catalogLoading,
  wipeLoading,
  onAddNew,
  onClearBoard,
}: {
  catalogLoading: boolean
  wipeLoading: boolean
  onAddNew: () => void
  onClearBoard: () => void
}) {
  const [menuReady, setMenuReady] = useState(false)
  useEffect(() => {
    setMenuReady(true)
  }, [])

  const disabled = catalogLoading || wipeLoading

  if (!menuReady) {
    return (
      <Button
        type="button"
        className="gap-2"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={false}
        aria-label="New risk (loading menu)"
      >
        <Plus className="size-4" />
        New risk
        <ChevronDown className="size-4 opacity-70" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" className="gap-2" disabled={disabled}>
          <Plus className="size-4" />
          New risk
          <ChevronDown className="size-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onAddNew}>
          <Plus className="size-4" />
          Add new risk
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={wipeLoading || catalogLoading}
          onClick={() => void onClearBoard()}
        >
          <Trash2 className="size-4" />
          Clear entire board
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function suggestRiskNo(risks: RiskRow[]): string {
  let max = 0
  const re = /BON-SR-(\d+)/i
  for (const r of risks) {
    const m = r.riskNo.match(re)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const next = max > 0 ? max + 1 : 1
  return `BON-SR-${String(next).padStart(4, "0")}`
}

type TitleDotOpt = "" | "amber" | "red" | "green"

type RiskFormState = {
  id: string
  riskNo: string
  date: string
  title: string
  titleDot: TitleDotOpt
  initial: string
  final: string
  field: string
  threads: string
  threadsHighlight: boolean
  status: string
  statusTone: RiskStatusTone
}

function emptyRiskForm(risks: RiskRow[]): RiskFormState {
  return {
    id: "",
    riskNo: suggestRiskNo(risks),
    date: todayYmd(),
    title: "",
    titleDot: "",
    initial: "Not Determined",
    final: "Not Determined",
    field: "",
    threads: "No special actions required",
    threadsHighlight: false,
    status: "Awaiting Assessment",
    statusTone: "awaiting",
  }
}

function rowToForm(row: RiskRow): RiskFormState {
  return {
    id: row.id,
    riskNo: row.riskNo,
    date: row.date,
    title: row.title,
    titleDot: (row.titleDot ?? "") as TitleDotOpt,
    initial: row.initial,
    final: row.final,
    field: row.field,
    threads: row.threads,
    threadsHighlight: !!row.threadsHighlight,
    status: row.status,
    statusTone: row.statusTone,
  }
}

function formToRow(form: RiskFormState, id: string): RiskRow {
  const titleDot =
    form.titleDot === "" ? undefined : (form.titleDot as "amber" | "red" | "green")
  return {
    id,
    riskNo: form.riskNo.trim(),
    date: form.date.trim(),
    title: form.title.trim(),
    ...(titleDot ? { titleDot } : {}),
    initial: form.initial.trim(),
    final: form.final.trim(),
    field: form.field.trim(),
    threads: form.threads.trim(),
    ...(form.threadsHighlight ? { threadsHighlight: true } : {}),
    status: form.status.trim(),
    statusTone: form.statusTone,
  }
}

export function RiskBoardView() {
  const [risks, setRisks] = useState<RiskRow[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogSaving, setCatalogSaving] = useState(false)
  const [wipeLoading, setWipeLoading] = useState(false)
  const [serverSummaries, setServerSummaries] = useState<BoardSummary[] | null>(
    null
  )
  const [boardRefreshNonce, setBoardRefreshNonce] = useState(0)
  const pathname = usePathname()
  const [keyword, setKeyword] = useState("")

  const [riskFormOpen, setRiskFormOpen] = useState(false)
  const [riskFormMode, setRiskFormMode] = useState<"create" | "edit">("create")
  const [riskForm, setRiskForm] = useState<RiskFormState>(() =>
    emptyRiskForm([])
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/safety/risk-board-catalog", {
          credentials: "include",
        })
        if (cancelled) return
        if (!res.ok) {
          setRisks([])
          if (res.status === 401) {
            toast.error("Oturum gerekli — risk listesi yüklenemedi.")
          }
          return
        }
        const data = (await res.json()) as { entries?: RiskRow[] }
        if (Array.isArray(data.entries)) {
          setRisks(data.entries.map((r) => ({ ...r })))
        } else {
          setRisks([])
        }
      } catch {
        if (!cancelled) {
          setRisks([])
          toast.error("Risk listesi yüklenemedi.")
        }
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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

  const loadSummaries = useCallback(async () => {
    try {
      const res = await fetch("/api/safety/risk-board-summaries", {
        credentials: "include",
      })
      if (!res.ok) {
        setServerSummaries([])
        return
      }
      const data = (await res.json()) as { boards?: BoardSummary[] }
      setServerSummaries(Array.isArray(data.boards) ? data.boards : [])
    } catch {
      setServerSummaries([])
    } finally {
      setBoardRefreshNonce((n) => n + 1)
    }
  }, [])

  const persistCatalog = useCallback(
    async (nextEntries: RiskRow[], rollback: () => void) => {
      setCatalogSaving(true)
      try {
        const res = await fetch("/api/safety/risk-board-catalog", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: nextEntries }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) {
          rollback()
          toast.error(
            typeof data.error === "string"
              ? data.error
              : "Kayıt başarısız — değişiklikler geri alındı."
          )
          return false
        }
        void loadSummaries()
        return true
      } catch {
        rollback()
        toast.error("Ağ hatası — değişiklikler geri alındı.")
        return false
      } finally {
        setCatalogSaving(false)
      }
    },
    [loadSummaries]
  )

  useEffect(() => {
    if (pathname === "/safety/risk-board") void loadSummaries()
  }, [pathname, loadSummaries])

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null
    const onVis = () => {
      if (document.visibilityState !== "visible") return
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => void loadSummaries(), 2000)
    }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      document.removeEventListener("visibilitychange", onVis)
      if (debounce) clearTimeout(debounce)
    }
  }, [loadSummaries])

  const liveInitialByKey = useMemo(() => {
    const map: Record<string, string> = {}
    if (serverSummaries) {
      for (const b of serverSummaries) {
        if (
          typeof b.probability === "number" &&
          b.probability >= 1 &&
          b.probability <= 5 &&
          typeof b.severity === "string" &&
          /^[EDCBA]$/i.test(b.severity)
        ) {
          map[b.riskKey] = assessmentCodeFromParts(
            b.probability,
            b.severity
          )
        }
      }
    }
    for (const r of risks) {
      const k = riskBoardKeyFromTitle(r.title)
      if (map[k]) continue
      const local = readLocalRiskBoardAssessment(r.title)
      if (local) {
        map[k] = assessmentCodeFromParts(local.probability, local.severity)
      }
    }
    return map
  }, [serverSummaries, risks, boardRefreshNonce])

  const openCreateRisk = () => {
    setRiskFormMode("create")
    setRiskForm(emptyRiskForm(risks))
    setRiskFormOpen(true)
  }

  const openEditRisk = (row: RiskRow) => {
    setRiskFormMode("edit")
    setRiskForm(rowToForm(row))
    setRiskFormOpen(true)
  }

  const saveRiskForm = () => {
    const title = riskForm.title.trim()
    if (!title) {
      toast.error("Başlık zorunludur.")
      return
    }
    const prevSnapshot = risks
    const mode = riskFormMode
    let next: RiskRow[]
    if (riskFormMode === "create") {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `risk-${Date.now()}`
      next = [...risks, formToRow(riskForm, id)]
    } else {
      const id = riskForm.id
      if (!id) return
      next = risks.map((r) => (r.id === id ? formToRow(riskForm, id) : r))
    }
    setRisks(next)
    setRiskFormOpen(false)
    void (async () => {
      const ok = await persistCatalog(next, () => setRisks(prevSnapshot))
      if (ok) {
        toast.success(
          mode === "create" ? "Risk oluşturuldu." : "Risk güncellendi."
        )
      }
    })()
  }

  const removeRisk = (id: string) => {
    if (
      !window.confirm(
        "Bu riski listeden kaldırmak istiyor musunuz? Kalıcı olarak silinecek; bu başlığa ait kayıtlı risk değerlendirme (bow-tie) verisi de veritabanından silinir."
      )
    ) {
      return
    }
    const prevSnapshot = risks
    const updated = prevSnapshot.filter((r) => r.id !== id)
    setRisks(updated)
    void (async () => {
      const ok = await persistCatalog(updated, () => setRisks(prevSnapshot))
      if (ok) toast.success("Risk silindi.")
    })()
  }

  const wipeEntireBoard = async () => {
    if (
      !window.confirm(
        "Tüm risk satırları ve kayıtlı bow-tie değerlendirmeleri kalıcı olarak silinecek. Emin misiniz?"
      )
    ) {
      return
    }
    setWipeLoading(true)
    const prev = risks
    setRisks([])
    try {
      const res = await fetch("/api/safety/risk-board-catalog", {
        method: "DELETE",
        credentials: "include",
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setRisks(prev)
        toast.error(
          typeof data.error === "string"
            ? data.error
            : "Tablo boşaltılamadı."
        )
        return
      }
      toast.success("Risk board tamamen boşaltıldı.")
      void loadSummaries()
    } catch {
      setRisks(prev)
      toast.error("Ağ hatası.")
    } finally {
      setWipeLoading(false)
    }
  }

  const tableEmptyMessage =
    risks.length === 0
      ? "Henüz kayıtlı risk yok. Sağ üstten New risk → Add new risk ile ekleyin."
      : "Filtreye uyan risk yok."

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-muted/20 p-4 md:p-6">
      <Button type="button" variant="outline" size="sm" className="w-fit">
        Advanced filtering
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
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

        <RiskBoardNewRiskDropdown
          catalogLoading={catalogLoading}
          wipeLoading={wipeLoading}
          onAddNew={openCreateRisk}
          onClearBoard={wipeEntireBoard}
        />
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
            {catalogLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground h-24 text-center">
                  Liste yükleniyor…
                </TableCell>
              </TableRow>
            ) : null}
            {!catalogLoading && filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground h-24 text-center">
                  {tableEmptyMessage}
                </TableCell>
              </TableRow>
            ) : null}
            {!catalogLoading &&
              filtered.map((row) => (
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
                          <Link href={taskBoardHref(row.title)}>
                            Open risk assessment
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openEditRisk(row)}>
                          <Pencil className="size-4" />
                          Edit risk
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
                  <TableCell className="whitespace-nowrap">
                    {(() => {
                      const rk = riskBoardKeyFromTitle(row.title)
                      const initialShown =
                        liveInitialByKey[rk] ?? row.initial
                      const parsed = parseRiskLevelCode(initialShown)
                      if (!parsed) {
                        return (
                          <span className="text-sm text-foreground">
                            {initialShown}
                          </span>
                        )
                      }
                      const tone = riskMatrixToneFromSelection(
                        parsed.probability,
                        parsed.severity
                      )
                      return (
                        <span
                          className={cn(
                            "inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums",
                            firstAssessmentCellClass(tone)
                          )}
                        >
                          {formatRiskAssessmentWithBand(
                            parsed.probability,
                            parsed.severity
                          )}
                        </span>
                      )
                    })()}
                  </TableCell>
                  <TableCell>{row.final}</TableCell>
                  <TableCell className="max-w-[140px] whitespace-normal text-sm">
                    {row.field}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "max-w-[200px] whitespace-normal text-sm",
                      row.threadsHighlight &&
                        "font-medium text-amber-700 dark:text-amber-400"
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
        open={riskFormOpen}
        onOpenChange={(open) => {
          setRiskFormOpen(open)
        }}
      >
        <DialogContent className="flex max-h-[min(90dvh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
            <DialogTitle>
              {riskFormMode === "create" ? "New risk" : "Edit risk"}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="rf-riskNo">Risk no</Label>
                <Input
                  id="rf-riskNo"
                  value={riskForm.riskNo}
                  onChange={(e) =>
                    setRiskForm((f) => ({ ...f, riskNo: e.target.value }))
                  }
                  placeholder="BON-SR-0001"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rf-date">Date</Label>
                <Input
                  id="rf-date"
                  type="date"
                  value={riskForm.date}
                  onChange={(e) =>
                    setRiskForm((f) => ({ ...f, date: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rf-title">Title</Label>
              <Input
                id="rf-title"
                value={riskForm.title}
                onChange={(e) =>
                  setRiskForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Risk / event title"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Title marker</Label>
                <Select
                  value={riskForm.titleDot || "none"}
                  onValueChange={(v) =>
                    setRiskForm((f) => ({
                      ...f,
                      titleDot: v === "none" ? "" : (v as TitleDotOpt),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="amber">Amber</SelectItem>
                    <SelectItem value="red">Red</SelectItem>
                    <SelectItem value="green">Green</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status tone</Label>
                <Select
                  value={riskForm.statusTone}
                  onValueChange={(v) =>
                    setRiskForm((f) => ({
                      ...f,
                      statusTone: v as RiskStatusTone,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="awaiting">Awaiting</SelectItem>
                    <SelectItem value="mitigation">Mitigation</SelectItem>
                    <SelectItem value="monitored">Monitored</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rf-status">Status label</Label>
              <Input
                id="rf-status"
                value={riskForm.status}
                onChange={(e) =>
                  setRiskForm((f) => ({ ...f, status: e.target.value }))
                }
                placeholder="e.g. Awaiting Assessment"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="rf-initial">Initial assessment</Label>
                <Input
                  id="rf-initial"
                  value={riskForm.initial}
                  onChange={(e) =>
                    setRiskForm((f) => ({ ...f, initial: e.target.value }))
                  }
                  placeholder="Not Determined or e.g. 3C"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rf-final">Final assessment</Label>
                <Input
                  id="rf-final"
                  value={riskForm.final}
                  onChange={(e) =>
                    setRiskForm((f) => ({ ...f, final: e.target.value }))
                  }
                  placeholder="Not Determined or e.g. 2D"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rf-field">Field</Label>
              <Input
                id="rf-field"
                value={riskForm.field}
                onChange={(e) =>
                  setRiskForm((f) => ({ ...f, field: e.target.value }))
                }
                placeholder="Department / area"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rf-threads">Threads & consequences & mitigations</Label>
              <Textarea
                id="rf-threads"
                className="min-h-[88px] resize-y"
                value={riskForm.threads}
                onChange={(e) =>
                  setRiskForm((f) => ({ ...f, threads: e.target.value }))
                }
                placeholder="Short description"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={riskForm.threadsHighlight}
                onChange={(e) =>
                  setRiskForm((f) => ({
                    ...f,
                    threadsHighlight: e.target.checked,
                  }))
                }
              />
              Highlight threads column
            </label>
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRiskFormOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={catalogSaving || !riskForm.title.trim()}
              onClick={saveRiskForm}
            >
              {catalogSaving ? "Saving…" : riskFormMode === "create" ? "Create" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
