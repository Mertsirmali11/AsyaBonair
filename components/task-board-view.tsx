"use client"

import Link from "next/link"
import { createPortal } from "react-dom"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react"
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  Info,
  Lightbulb,
  Pencil,
  Plus,
  Printer,
  SquarePen,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Badge } from "@/components/ui/badge"
import { riskBoardKeyFromTitle } from "@/lib/safety-risk-board-key"
import {
  type RiskMatrixTone,
  firstAssessmentCellClass,
  formatRiskAssessmentWithBand,
  riskMatrixToneFromSelection,
} from "@/lib/safety-risk-matrix"
import { cn } from "@/lib/utils"

function StaticButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      tabIndex={-1}
      className={className}
      {...props}
      onClick={(e) => e.preventDefault()}
    />
  )
}

const MATRIX_SELECTED: Record<
  RiskMatrixTone,
  string
> = {
  green:
    "border-emerald-600 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 dark:hover:bg-emerald-700",
  yellow:
    "border-amber-500 bg-amber-400 text-amber-950 shadow-sm hover:bg-amber-500 dark:bg-amber-500 dark:text-amber-950",
  red: "border-red-600 bg-red-600 text-white shadow-sm hover:bg-red-700 dark:hover:bg-red-700",
}

const MATRIX_BAR: Record<RiskMatrixTone, string> = {
  green: "bg-emerald-600 text-white dark:bg-emerald-600",
  yellow: "bg-amber-500 text-white dark:bg-amber-500",
  red: "bg-red-600 text-white dark:bg-red-600",
}

function AssessmentMatrixButton({
  selected,
  onClick,
  children,
  matrixTone,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  /** İkisi de seçiliyken matris rengi; eksik seçimde null */
  matrixTone: RiskMatrixTone | null
}) {
  return (
    <Button
      type="button"
      variant={selected && !matrixTone ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className={cn(
        "size-9 min-w-9 shrink-0 rounded-md border p-0 font-semibold",
        selected && matrixTone
          ? MATRIX_SELECTED[matrixTone]
          : selected
            ? "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            : "border-border bg-background text-foreground hover:bg-muted/60"
      )}
    >
      {children}
    </Button>
  )
}

function openMapForIds(ids: string[], open: boolean): Record<string, boolean> {
  return Object.fromEntries(ids.map((id) => [id, open]))
}

function nextReference(existing: string[]): string {
  let max = 10990
  for (const r of existing) {
    const m = /^#(\d+)$/.exec(r.trim())
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `#${max + 1}`
}

function newBarrierId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function ymdToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatRiskDocDate(ymd: string): string {
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!p) return ymd
  const dt = new Date(Number(p[1]), Number(p[2]) - 1, Number(p[3]))
  return dt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** PDF örneğindeki bant metinleri (Acceptable → Desirable vb.) */
function printBandLabelForDoc(tone: RiskMatrixTone): string {
  switch (tone) {
    case "green":
      return "Desirable"
    case "yellow":
      return "ALARP"
    case "red":
      return "Unacceptable"
  }
}

export type BarrierEntry = {
  id: string
  text: string
  /** YYYY-MM-DD; eski düz metin bariyerlerde boş olabilir */
  recordedAt: string
}

type HistoryEntry = {
  id: string
  date: string
  message: string
  /** Kayıt anındaki kullanıcı (eski kayıtlarda yoksa UI’da varsayılan gösterilir) */
  actor?: string
}

function barrierFromUnknown(b: unknown): BarrierEntry {
  if (typeof b === "string") {
    return { id: newBarrierId(), text: b, recordedAt: "" }
  }
  if (b && typeof b === "object") {
    const o = b as Record<string, unknown>
    if (typeof o.text === "string") {
      return {
        id: typeof o.id === "string" ? o.id : newBarrierId(),
        text: o.text,
        recordedAt: typeof o.recordedAt === "string" ? o.recordedAt : "",
      }
    }
  }
  return { id: newBarrierId(), text: "", recordedAt: "" }
}

type BoardRow = {
  id: string
  /** Metin: "Equipment failure" → başlıkta "1. Threat — Equipment failure" */
  label: string
  reference: string
  barriers: BarrierEntry[]
  /** Bariyer yoksa kutuda gösterilen açıklama */
  fallbackNote: string
}

function isBarrierJsonItem(b: unknown): boolean {
  if (typeof b === "string") return true
  if (!b || typeof b !== "object") return false
  return typeof (b as Record<string, unknown>).text === "string"
}

function toBoardRow(x: unknown): BoardRow | null {
  if (!x || typeof x !== "object") return null
  const o = x as Record<string, unknown>
  if (
    typeof o.id !== "string" ||
    typeof o.label !== "string" ||
    typeof o.reference !== "string" ||
    typeof o.fallbackNote !== "string"
  ) {
    return null
  }
  if (!Array.isArray(o.barriers) || !o.barriers.every(isBarrierJsonItem)) {
    return null
  }
  return {
    id: o.id,
    label: o.label,
    reference: o.reference,
    barriers: o.barriers.map(barrierFromUnknown),
    fallbackNote: o.fallbackNote,
  }
}

type ExistingRiskOption = {
  id: string
  riskNo: string
  title: string
}

const INITIAL_THREATS: BoardRow[] = [
  {
    id: "t-1",
    label: "Equipment failure",
    reference: "#10992",
    barriers: [
      {
        id: "init-t1-b0",
        text: "Periodic maintenance and pre-operational daily checks.",
        recordedAt: "",
      },
    ],
    fallbackNote: "",
  },
  {
    id: "t-2",
    label: "Human factors",
    reference: "#11001",
    barriers: [],
    fallbackNote:
      "Time pressure, fatigue, and communication gaps during line operations.",
  },
]

const INITIAL_CONSEQUENCES: BoardRow[] = [
  {
    id: "c-1",
    label: "Structural damage",
    reference: "#10995",
    barriers: [],
    fallbackNote: "Further consequences can be linked here (preview).",
  },
  {
    id: "c-2",
    label: "Operational disruption",
    reference: "#10998",
    barriers: [],
    fallbackNote:
      "Delays, cancellations, or fleet availability impact if damage propagates.",
  },
]

const DEFAULT_EVENT_TITLE = "TC-IHY — Right flap trailing edge damage"

/** Eski sadece ilk değerlendirme kayıtları (migration) */
const LEGACY_INITIAL_ASSESSMENT_PREFIX =
  "asyabonair:task-board:initial-assessment:"

const TASK_BOARD_SNAPSHOT_PREFIX = "asyabonair:task-board:v1:"

function taskBoardSnapshotKey(eventTitle: string): string {
  const rk = riskBoardKeyFromTitle(eventTitle)
  return `${TASK_BOARD_SNAPSHOT_PREFIX}${encodeURIComponent(rk)}`
}

function legacyInitialAssessmentKey(eventTitle: string): string {
  return `${LEGACY_INITIAL_ASSESSMENT_PREFIX}${encodeURIComponent(eventTitle)}`
}

type TaskBoardSnapshotV1 = {
  v: 1
  probability: number | null
  severity: string | null
  threats: BoardRow[]
  consequences: BoardRow[]
  threatOpenById: Record<string, boolean>
  consequenceOpenById: Record<string, boolean>
  history: HistoryEntry[]
}

function parseHistoryJson(json: unknown): HistoryEntry[] {
  if (!Array.isArray(json)) return []
  const out: HistoryEntry[] = []
  for (const item of json) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    if (
      typeof o.id === "string" &&
      typeof o.date === "string" &&
      typeof o.message === "string"
    ) {
      out.push({
        id: o.id,
        date: o.date,
        message: o.message,
        actor: typeof o.actor === "string" ? o.actor : undefined,
      })
    }
  }
  return out
}

function readLegacyInitialAssessmentOnly(
  eventTitle: string
): { probability: number; severity: string } | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(legacyInitialAssessmentKey(eventTitle))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return null
    const p = (parsed as { probability?: unknown }).probability
    const s = (parsed as { severity?: unknown }).severity
    if (
      typeof p !== "number" ||
      p < 1 ||
      p > 5 ||
      typeof s !== "string" ||
      !/^[EDCBA]$/i.test(s)
    ) {
      return null
    }
    return { probability: p, severity: s.toUpperCase() }
  } catch {
    return null
  }
}

function readTaskBoardSnapshotRaw(storageKey: string): TaskBoardSnapshotV1 | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return null
    const o = parsed as Record<string, unknown>
    if (o.v !== 1) return null
    const p = o.probability
    const s = o.severity
    if (
      p !== null &&
      p !== undefined &&
      (typeof p !== "number" || p < 1 || p > 5)
    ) {
      return null
    }
    if (
      s !== null &&
      s !== undefined &&
      (typeof s !== "string" || !/^[EDCBA]$/i.test(s))
    ) {
      return null
    }
    if (!Array.isArray(o.threats) || !Array.isArray(o.consequences)) {
      return null
    }
    const threats = o.threats.map(toBoardRow)
    const consequences = o.consequences.map(toBoardRow)
    if (threats.some((t) => t === null) || consequences.some((c) => c === null)) {
      return null
    }
    const threatOpenById =
      o.threatOpenById &&
      typeof o.threatOpenById === "object" &&
      !Array.isArray(o.threatOpenById)
        ? (o.threatOpenById as Record<string, boolean>)
        : {}
    const consequenceOpenById =
      o.consequenceOpenById &&
      typeof o.consequenceOpenById === "object" &&
      !Array.isArray(o.consequenceOpenById)
        ? (o.consequenceOpenById as Record<string, boolean>)
        : {}
    return {
      v: 1,
      probability: p === undefined || p === null ? null : p,
      severity:
        s === undefined || s === null ? null : (s as string).toUpperCase(),
      threats: threats as BoardRow[],
      consequences: consequences as BoardRow[],
      threatOpenById,
      consequenceOpenById,
      history: parseHistoryJson(o.history),
    }
  } catch {
    return null
  }
}

function readTaskBoardSnapshot(eventTitle: string): TaskBoardSnapshotV1 | null {
  const primary = readTaskBoardSnapshotRaw(taskBoardSnapshotKey(eventTitle))
  if (primary) return primary
  const legacyKey = `${TASK_BOARD_SNAPSHOT_PREFIX}${encodeURIComponent(eventTitle.trim())}`
  return readTaskBoardSnapshotRaw(legacyKey)
}

function writeTaskBoardSnapshot(
  eventTitle: string,
  data: TaskBoardSnapshotV1
): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(
      taskBoardSnapshotKey(eventTitle),
      JSON.stringify(data)
    )
    localStorage.removeItem(legacyInitialAssessmentKey(eventTitle))
  } catch {
    // quota / private mode
  }
}

function defaultSnapshotForTitle(eventTitle: string): TaskBoardSnapshotV1 {
  const legacy = readLegacyInitialAssessmentOnly(eventTitle)
  const threats = INITIAL_THREATS.map((t) => ({ ...t }))
  const consequences = INITIAL_CONSEQUENCES.map((c) => ({ ...c }))
  return {
    v: 1,
    probability: legacy?.probability ?? null,
    severity: legacy?.severity ?? null,
    threats,
    consequences,
    threatOpenById: openMapForIds(threats.map((t) => t.id), true),
    consequenceOpenById: openMapForIds(consequences.map((c) => c.id), true),
    history: [],
  }
}

function parseOpenMapJson(json: unknown): Record<string, boolean> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {}
  const o = json as Record<string, unknown>
  const out: Record<string, boolean> = {}
  for (const k of Object.keys(o)) {
    if (typeof o[k] === "boolean") out[k] = o[k]
  }
  return out
}

function parseBoardRowsJson(json: unknown): BoardRow[] | null {
  if (!Array.isArray(json)) return null
  const rows = json.map(toBoardRow)
  if (rows.some((r) => r === null)) return null
  return rows as BoardRow[]
}

function ThreatConsequenceExpandedBody({
  variant,
  item,
  onRegisterAsRisk,
  onEdit,
  onDelete,
  onAddBarrier,
}: {
  variant: "threat" | "consequence"
  item: BoardRow
  onRegisterAsRisk: () => void
  onEdit: () => void
  onDelete: () => void
  onAddBarrier: () => void
}) {
  const boxBorder =
    variant === "threat"
      ? "border-sky-200/80 bg-sky-100/50 dark:border-sky-900/50 dark:bg-sky-950/30"
      : "border-rose-200/80 bg-rose-100/50 dark:border-rose-900/50 dark:bg-rose-950/30"

  const primaryBtn =
    variant === "threat"
      ? "border-0 bg-sky-500 text-white hover:bg-sky-600"
      : "border-0 bg-rose-600 text-white hover:bg-rose-700"

  const secondaryBtn = "border-0 bg-[#2d3748] text-white hover:bg-[#1e293b]"

  const contentBlocks: { key: string; text: string }[] =
    item.barriers.length > 0
      ? item.barriers.map((b) => ({ key: b.id, text: b.text }))
      : item.fallbackNote.trim().length > 0
        ? [{ key: `${item.id}-fb`, text: item.fallbackNote.trim() }]
        : []

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className={primaryBtn}
          onClick={onRegisterAsRisk}
        >
          <Plus className="size-3.5" />
          Register as risk
        </Button>
        <Button type="button" size="sm" className={secondaryBtn} onClick={onEdit}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </div>
      <Button type="button" size="sm" className={secondaryBtn} onClick={onAddBarrier}>
        <Plus className="size-3.5" />
        Barrier
      </Button>
      {contentBlocks.length > 0 ? (
        <div className="space-y-2">
          {contentBlocks.map((block) => (
            <div
              key={`${item.id}-block-${block.key}`}
              className={cn("rounded-md border px-3 py-2.5 text-sm text-foreground", boxBorder)}
            >
              {block.text}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No barrier or description yet. Use Edit or + Barrier.
        </p>
      )}
    </div>
  )
}

function BoardCollapsibleRow({
  variant,
  item,
  index,
  open,
  onOpenChange,
  onRegisterAsRisk,
  onEdit,
  onDelete,
  onAddBarrier,
}: {
  variant: "threat" | "consequence"
  item: BoardRow
  index: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onRegisterAsRisk: () => void
  onEdit: () => void
  onDelete: () => void
  onAddBarrier: () => void
}) {
  const isThreat = variant === "threat"
  const title = isThreat
    ? `${index + 1}. Threat — ${item.label}`
    : `${index + 1}. Consequence — ${item.label}`

  const shell = isThreat
    ? "rounded-lg border border-sky-200 bg-sky-50/80 dark:border-sky-900/60 dark:bg-sky-950/20"
    : "rounded-lg border border-rose-200 bg-rose-50/80 dark:border-rose-900/50 dark:bg-rose-950/20"

  const headerBorder = isThreat
    ? "border-b border-sky-200/80 dark:border-sky-900/50"
    : "border-b border-rose-200/80 dark:border-rose-900/50"

  const headerHover = isThreat
    ? "hover:bg-sky-100/80 dark:hover:bg-sky-950/40"
    : "hover:bg-rose-100/80 dark:hover:bg-rose-950/40"

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className={shell}>
      <div className={cn("flex w-full items-stretch", headerBorder)}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "group flex min-w-0 flex-1 items-start gap-2 px-3 py-3 text-left transition-colors",
              headerHover
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground">{item.reference}</p>
            </div>
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </button>
        </CollapsibleTrigger>
        <div className="flex shrink-0 items-center pr-2">
          <Button type="button" variant="ghost" size="icon-sm" className="size-8" disabled>
            <Info className="size-4" />
          </Button>
        </div>
      </div>
      <CollapsibleContent>
        <ThreatConsequenceExpandedBody
          variant={variant}
          item={item}
          onRegisterAsRisk={onRegisterAsRisk}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddBarrier={onAddBarrier}
        />
      </CollapsibleContent>
    </Collapsible>
  )
}

type RowFormState = {
  label: string
  reference: string
  barriersText: string
  fallbackNote: string
}

function emptyRowForm(): RowFormState {
  return { label: "", reference: "", barriersText: "", fallbackNote: "" }
}

function rowToForm(row: BoardRow): RowFormState {
  return {
    label: row.label,
    reference: row.reference,
    barriersText: row.barriers.map((b) => b.text).join("\n"),
    fallbackNote: row.fallbackNote,
  }
}

function formToBarrierEntries(
  text: string,
  previous: BarrierEntry[]
): BarrierEntry[] {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  const today = ymdToday()
  return lines.map((line, i) => {
    const prev = previous[i]
    if (prev && prev.text === line) return { ...prev }
    if (prev) {
      return {
        id: prev.id,
        text: line,
        recordedAt: prev.recordedAt || today,
      }
    }
    return { id: newBarrierId(), text: line, recordedAt: today }
  })
}

/** Bariyer ekleme / silme / metin düzenleme — geçmiş satırları */
function describeBarrierDiffMessages(
  prev: BarrierEntry[],
  next: BarrierEntry[],
  parentKind: "Threat" | "Consequence",
  parentLabel: string
): string[] {
  const messages: string[] = []
  const prevById = new Map(prev.map((b) => [b.id, b]))
  const nextById = new Map(next.map((b) => [b.id, b]))
  for (const [, b] of prevById) {
    if (!nextById.has(b.id)) {
      messages.push(
        `Barrier "${b.text}" was deleted from ${parentKind} "${parentLabel}"`
      )
    }
  }
  for (const [, b] of nextById) {
    if (!prevById.has(b.id)) {
      messages.push(
        `Barrier "${b.text}" was added to ${parentKind} "${parentLabel}"`
      )
    } else {
      const oldB = prevById.get(b.id)!
      if (oldB.text !== b.text) {
        messages.push(
          `Barrier under ${parentKind} "${parentLabel}" was edited from "${oldB.text}" to "${b.text}"`
        )
      }
    }
  }
  return messages
}

function PrintMatrixCell({
  selected,
  tone,
  children,
}: {
  selected: boolean
  tone: RiskMatrixTone | null
  children: ReactNode
}) {
  let bg = "#fafafa"
  let fg = "#18181b"
  let border = "#d4d4d8"
  if (selected && tone) {
    if (tone === "green") {
      bg = "#16a34a"
      fg = "#ffffff"
      border = "#15803d"
    } else if (tone === "yellow") {
      bg = "#eab308"
      fg = "#1c1917"
      border = "#ca8a04"
    } else {
      bg = "#dc2626"
      fg = "#ffffff"
      border = "#b91c1c"
    }
  } else if (selected) {
    bg = "#2563eb"
    fg = "#ffffff"
    border = "#1d4ed8"
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 28,
        height: 28,
        fontSize: 12,
        fontWeight: 700,
        borderRadius: 4,
        border: `1px solid ${border}`,
        backgroundColor: bg,
        color: fg,
      }}
    >
      {children}
    </div>
  )
}

type RiskAssessmentPrintDocProps = {
  displayTitle: string
  insertionYmd: string
  revisionYmd: string
  insertedBy: string
  resource: string
  connectedSpis: string
  preAssessmentLine: string
  preAssessmentTone: RiskMatrixTone | null
  postAssessmentLine: string
  statusLabel: string
  threats: BoardRow[]
  consequences: BoardRow[]
  selectedProbability: number | null
  selectedSeverity: string | null
  livePreviewCode: string | null
  liveMatrixTone: RiskMatrixTone | null
  riskLevelLine: string
  barrierRecordRows: {
    key: string
    taskName: string
    source: string
    recordDate: string
    responsible: string
    dueDate: string
    status: string
  }[]
  history: HistoryEntry[]
  historyActor: string
}

function RiskAssessmentPrintDocument({
  displayTitle,
  insertionYmd,
  revisionYmd,
  insertedBy,
  resource,
  connectedSpis,
  preAssessmentLine,
  preAssessmentTone,
  postAssessmentLine,
  statusLabel,
  threats,
  consequences,
  selectedProbability,
  selectedSeverity,
  livePreviewCode,
  liveMatrixTone,
  riskLevelLine,
  barrierRecordRows,
  history,
  historyActor,
}: RiskAssessmentPrintDocProps) {
  const insertionDisplay = formatRiskDocDate(insertionYmd)
  const docTitle = `${displayTitle} — (${insertionYmd})`

  const detailRow = (label: string, value: string) => (
    <div
      className="ra-avoid-break"
      style={{
        borderBottom: "1px solid #e4e4e7",
        padding: "10px 12px",
        backgroundColor: "#ffffff",
      }}
    >
      <div style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 15,
          fontWeight: 600,
          color: "#09090b",
          lineHeight: 1.35,
        }}
      >
        {value}
      </div>
    </div>
  )

  const threatBody = (t: BoardRow) =>
    t.barriers[0]?.text?.trim() ||
    t.fallbackNote?.trim() ||
    "—"

  return (
    <div
      id="risk-assessment-print-root"
      className="ra-print-doc"
      style={{
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: 13,
        lineHeight: 1.45,
        color: "#09090b",
        backgroundColor: "#ffffff",
        maxWidth: "100%",
      }}
    >
      <table
        className="ra-avoid-break"
        style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}
      >
        <tbody>
          <tr>
            <td style={{ width: "22%", verticalAlign: "top", padding: "4px 8px 4px 0" }}>
              <img
                src="/logo.png"
                alt="Bonair"
                style={{
                  maxHeight: 45,
                  maxWidth: 140,
                  width: "auto",
                  height: "auto",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </td>
            <td style={{ width: "56%", verticalAlign: "middle", textAlign: "center", padding: "8px" }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{docTitle}</div>
              <div style={{ fontSize: 11, color: "#71717a", marginTop: 4 }}>
                Risk assessment
              </div>
            </td>
            <td style={{ width: "22%", verticalAlign: "top", textAlign: "right", padding: "4px 0 4px 8px" }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>BON AIR</div>
              <div style={{ fontSize: 10, color: "#71717a", marginTop: 6 }}>
                Revision date
              </div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{revisionYmd}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div
        style={{
          border: "1px solid #d4d4d8",
          borderRadius: 6,
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        {detailRow("Risk title", displayTitle)}
        {detailRow("Insertion date", insertionDisplay)}
        {detailRow("Inserted by", insertedBy)}
        {detailRow("Resource", resource)}
        {detailRow("Connected SPIs", connectedSpis)}
        <div
          className="ra-avoid-break"
          style={{
            borderBottom: "1px solid #e4e4e7",
            padding: "10px 12px",
            backgroundColor:
              preAssessmentTone === "green"
                ? "#bbf7d0"
                : preAssessmentTone === "yellow"
                  ? "#fef08a"
                  : preAssessmentTone === "red"
                    ? "#fecaca"
                    : "#fef9c3",
          }}
        >
          <div style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Pre-assessment
          </div>
          <div style={{ marginTop: 4, fontSize: 15, fontWeight: 600, color: "#09090b" }}>
            {preAssessmentLine}
          </div>
        </div>
        {detailRow("Post-assessment", postAssessmentLine || "—")}
        {detailRow("Status", statusLabel)}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          alignItems: "start",
          marginBottom: 20,
        }}
      >
        <div className="ra-avoid-break">
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: "#0369a1" }}>
            Potential causes
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {threats.map((t, index) => (
              <div
                key={t.id}
                style={{
                  border: "1px solid #7dd3fc",
                  borderRadius: 6,
                  backgroundColor: "#e0f2fe",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "8px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderBottom: "1px solid #bae6fd",
                    color: "#0c4a6e",
                  }}
                >
                  {index + 1}. Threat — ({t.label}) ({t.reference})
                </div>
                <div style={{ padding: "10px 10px", fontSize: 12, color: "#1e3a5f" }}>
                  {threatBody(t)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ra-avoid-break">
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: "#a16207" }}>
            Risk
          </div>
          <div
            style={{
              border: "1px solid #fcd34d",
              borderRadius: 6,
              backgroundColor: "#fffbeb",
              padding: 12,
            }}
          >
            <div
              style={{
                textAlign: "center",
                fontSize: 13,
                fontWeight: 700,
                padding: "8px 10px",
                borderRadius: 4,
                backgroundColor: "#fef3c7",
                border: "1px solid #fde68a",
                marginBottom: 12,
                color: "#422006",
              }}
            >
              {displayTitle}
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textAlign: "center", marginBottom: 6 }}>
                Probability
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <PrintMatrixCell
                    key={n}
                    selected={selectedProbability === n}
                    tone={
                      liveMatrixTone !== null && selectedProbability === n
                        ? liveMatrixTone
                        : null
                    }
                  >
                    {n}
                  </PrintMatrixCell>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textAlign: "center", marginBottom: 6 }}>
                Severity
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                {(["E", "D", "C", "B", "A"] as const).map((l) => (
                  <PrintMatrixCell
                    key={l}
                    selected={selectedSeverity === l}
                    tone={
                      liveMatrixTone !== null && selectedSeverity === l
                        ? liveMatrixTone
                        : null
                    }
                  >
                    {l}
                  </PrintMatrixCell>
                ))}
              </div>
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: 12,
                fontWeight: 700,
                padding: "8px 10px",
                borderRadius: 4,
                marginBottom: 12,
                backgroundColor:
                  liveMatrixTone === "green"
                    ? "#16a34a"
                    : liveMatrixTone === "yellow"
                      ? "#eab308"
                      : liveMatrixTone === "red"
                        ? "#dc2626"
                        : "#475569",
                color: "#ffffff",
              }}
            >
              {riskLevelLine}
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                padding: "10px 10px",
                borderRadius: 4,
                backgroundColor: "#dbeafe",
                border: "1px solid #93c5fd",
                fontSize: 11,
                color: "#1e3a8a",
                lineHeight: 1.4,
              }}
            >
              <Lightbulb
                aria-hidden
                width={16}
                height={16}
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <span>
                <strong>Evaluating the assessment:</strong> To ensure the assessment, all control
                measures in the assessment must be evaluated.
              </span>
            </div>
          </div>
        </div>

        <div className="ra-avoid-break">
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: "#b91c1c" }}>
            Potential outcomes
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {consequences.map((c, index) => {
              const hasBarriers = c.barriers.some((b) => b.text.trim().length > 0)
              return (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid #fda4af",
                    borderRadius: 6,
                    backgroundColor: "#fff1f2",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "8px 10px",
                      fontSize: 12,
                      fontWeight: 700,
                      borderBottom: "1px solid #fecdd3",
                      color: "#881337",
                    }}
                  >
                    {index + 1}. Consequence — ({c.label}) ({c.reference})
                  </div>
                  <div style={{ padding: "10px 10px", fontSize: 12 }}>
                    {!hasBarriers ? (
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "flex-start",
                          padding: "10px 10px",
                          borderRadius: 4,
                          border: "2px solid #ef4444",
                          backgroundColor: "#fef2f2",
                          color: "#991b1b",
                        }}
                      >
                        <AlertTriangle aria-hidden width={16} height={16} style={{ flexShrink: 0 }} />
                        <span>
                          <strong>No barriers found!</strong> No barriers found for this risk/threat.
                        </span>
                      </div>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 18, color: "#450a0a" }}>
                        {c.barriers.map((b) => (
                          <li key={b.id} style={{ marginBottom: 4 }}>
                            {b.text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="ra-avoid-break" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>Barrier records</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #d4d4d8" }}>
          <thead>
            <tr style={{ backgroundColor: "#f4f4f5" }}>
              {["Task name", "Source", "Record date", "Responsible", "Due date", "Status"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      padding: "8px 10px",
                      borderBottom: "1px solid #d4d4d8",
                      color: "#52525b",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {barrierRecordRows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "14px 10px", color: "#71717a", fontSize: 12 }}>
                  No barrier records yet.
                </td>
              </tr>
            ) : (
              barrierRecordRows.map((r) => (
                <tr key={r.key} style={{ borderBottom: "1px solid #e4e4e7" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600, fontSize: 12 }}>{r.taskName}</td>
                  <td style={{ padding: "8px 10px", fontSize: 12 }}>{r.source}</td>
                  <td style={{ padding: "8px 10px", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                    {r.recordDate}
                  </td>
                  <td style={{ padding: "8px 10px", fontSize: 12, color: "#71717a" }}>
                    {r.responsible}
                  </td>
                  <td style={{ padding: "8px 10px", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                    {r.dueDate}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: 9999,
                        backgroundColor: "#7c3aed",
                        color: "#fff",
                      }}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        className="ra-avoid-break"
        style={{
          border: "1px solid #d4d4d8",
          borderRadius: 8,
          padding: 14,
          backgroundColor: "#e9ecef",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
          <Clock aria-hidden width={16} height={16} style={{ flexShrink: 0, color: "#52525b" }} />
          History
        </div>
        {history.length === 0 ? (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#71717a" }}>No history entries yet.</p>
        ) : (
          <ul style={{ margin: "12px 0 0", paddingLeft: 18, listStyle: "disc" }}>
            {history.map((entry) => (
              <li key={entry.id} style={{ marginBottom: 8, fontSize: 12 }}>
                <span style={{ fontVariantNumeric: "tabular-nums", color: "#52525b" }}>
                  {entry.date}
                </span>
                {" — "}
                {entry.message} by {historyActor}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p style={{ marginTop: 16, fontSize: 10, color: "#a1a1aa", textAlign: "center" }}>
        {livePreviewCode
          ? `Document risk code: ${livePreviewCode}`
          : "Probability / severity not fully selected"}
      </p>
    </div>
  )
}

export function TaskBoardView({
  riskTitle,
  actorName = "Kullanıcı",
}: {
  riskTitle?: string | null
  /** Geçmiş satırlarında “by …” için */
  actorName?: string | null
}) {
  const displayTitle =
    riskTitle && riskTitle.trim().length > 0
      ? riskTitle.trim()
      : DEFAULT_EVENT_TITLE

  const [threats, setThreats] = useState<BoardRow[]>(() =>
    INITIAL_THREATS.map((t) => ({ ...t }))
  )
  const [consequences, setConsequences] = useState<BoardRow[]>(() =>
    INITIAL_CONSEQUENCES.map((c) => ({ ...c }))
  )

  const [threatOpenById, setThreatOpenById] = useState<Record<string, boolean>>(() =>
    openMapForIds(INITIAL_THREATS.map((t) => t.id), true)
  )
  const [consequenceOpenById, setConsequenceOpenById] = useState<
    Record<string, boolean>
  >(() => openMapForIds(INITIAL_CONSEQUENCES.map((c) => c.id), true))

  const [threatDialogOpen, setThreatDialogOpen] = useState(false)
  const [threatDialogMode, setThreatDialogMode] = useState<"create" | "edit">(
    "create"
  )
  const [threatEditingId, setThreatEditingId] = useState<string | null>(null)
  const [threatForm, setThreatForm] = useState<RowFormState>(emptyRowForm)
  const [threatEntryOpen, setThreatEntryOpen] = useState(false)
  const [threatEntryMode, setThreatEntryMode] = useState<"existing" | "new">(
    "existing"
  )
  const [existingRiskOptions, setExistingRiskOptions] = useState<
    ExistingRiskOption[]
  >([])
  const [existingRiskValue, setExistingRiskValue] = useState<string>("")
  const [existingRisksLoading, setExistingRisksLoading] = useState(false)

  const [consequenceDialogOpen, setConsequenceDialogOpen] = useState(false)
  const [consequenceDialogMode, setConsequenceDialogMode] = useState<
    "create" | "edit"
  >("create")
  const [consequenceEditingId, setConsequenceEditingId] = useState<string | null>(
    null
  )
  const [consequenceForm, setConsequenceForm] = useState<RowFormState>(
    emptyRowForm
  )
  const [consequenceEntryOpen, setConsequenceEntryOpen] = useState(false)
  const [consequenceEntryMode, setConsequenceEntryMode] = useState<
    "existing" | "new"
  >("existing")
  const [existingRiskValueForConsequence, setExistingRiskValueForConsequence] =
    useState<string>("")

  const [barrierDialogOpen, setBarrierDialogOpen] = useState(false)
  const [barrierTarget, setBarrierTarget] = useState<{
    kind: "threat" | "consequence"
    id: string
  } | null>(null)
  const [barrierDraft, setBarrierDraft] = useState("")

  const [selectedProbability, setSelectedProbability] = useState<number | null>(
    null
  )
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null)

  const [history, setHistory] = useState<HistoryEntry[]>([])

  const skipPersistRef = useRef(true)
  const useServerPersistenceRef = useRef(true)
  const selectedProbabilityRef = useRef<number | null>(null)
  const selectedSeverityRef = useRef<string | null>(null)

  selectedProbabilityRef.current = selectedProbability
  selectedSeverityRef.current = selectedSeverity

  const historyActor = actorName?.trim() || "Kullanıcı"

  const appendHistory = useCallback(
    (message: string) => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `h-${Date.now()}`
      const actor = historyActor
      setHistory((prev) => [
        ...prev,
        { id, date: ymdToday(), message, actor },
      ])
    },
    [historyActor]
  )

  useLayoutEffect(() => {
    skipPersistRef.current = true
    const fromDisk = readTaskBoardSnapshot(displayTitle)
    const snap = fromDisk ?? defaultSnapshotForTitle(displayTitle)
    setThreats(snap.threats.map((t) => ({ ...t })))
    setConsequences(snap.consequences.map((c) => ({ ...c })))
    setSelectedProbability(snap.probability)
    setSelectedSeverity(snap.severity)
    setThreatOpenById({ ...snap.threatOpenById })
    setConsequenceOpenById({ ...snap.consequenceOpenById })
    setHistory(snap.history.map((h) => ({ ...h })))
    if (!fromDisk) {
      writeTaskBoardSnapshot(displayTitle, snap)
    }
  }, [displayTitle])

  useEffect(() => {
    let cancelled = false
    skipPersistRef.current = true
    ;(async () => {
      try {
        const rk = riskBoardKeyFromTitle(displayTitle)
        const res = await fetch(
          `/api/safety/risk-board-state?riskKey=${encodeURIComponent(rk)}`,
          { credentials: "include" }
        )
        if (cancelled) return
        if (res.status === 401) {
          useServerPersistenceRef.current = false
          return
        }
        useServerPersistenceRef.current = true
        if (!res.ok) return
        const data = (await res.json()) as { board: Record<string, unknown> | null }
        const b = data.board
        if (!b) return
        const threatsNext = parseBoardRowsJson(b.threats)
        const consNext = parseBoardRowsJson(b.consequences)
        if (!threatsNext || !consNext) return
        setThreats(threatsNext.map((t) => ({ ...t })))
        setConsequences(consNext.map((c) => ({ ...c })))
        const p = b.probability
        const s = b.severity
        setSelectedProbability(
          typeof p === "number" && p >= 1 && p <= 5 ? p : null
        )
        setSelectedSeverity(
          typeof s === "string" && /^[EDCBA]$/i.test(s) ? s.toUpperCase() : null
        )
        setThreatOpenById(parseOpenMapJson(b.threatOpenById))
        setConsequenceOpenById(parseOpenMapJson(b.consequenceOpenById))
      } catch {
        useServerPersistenceRef.current = false
      }
    })()
    return () => {
      cancelled = true
    }
  }, [displayTitle])

  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false
      return
    }
    const snap: TaskBoardSnapshotV1 = {
      v: 1,
      probability: selectedProbability,
      severity: selectedSeverity,
      threats: threats.map((t) => ({ ...t })),
      consequences: consequences.map((c) => ({ ...c })),
      threatOpenById: { ...threatOpenById },
      consequenceOpenById: { ...consequenceOpenById },
      history: history.map((h) => ({ ...h })),
    }
    const timer = window.setTimeout(() => {
      writeTaskBoardSnapshot(displayTitle, snap)
      if (!useServerPersistenceRef.current) return
      const rk = riskBoardKeyFromTitle(displayTitle)
      void fetch("/api/safety/risk-board-state", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riskKey: rk,
          riskTitle: displayTitle,
          probability: snap.probability,
          severity: snap.severity,
          threats: snap.threats,
          consequences: snap.consequences,
          threatOpenById: snap.threatOpenById,
          consequenceOpenById: snap.consequenceOpenById,
        }),
      }).catch(() => {})
    }, 650)
    return () => window.clearTimeout(timer)
  }, [
    displayTitle,
    threats,
    consequences,
    selectedProbability,
    selectedSeverity,
    threatOpenById,
    consequenceOpenById,
    history,
  ])

  const allThreatRefs = useMemo(
    () => threats.map((t) => t.reference),
    [threats]
  )
  const allConsequenceRefs = useMemo(
    () => consequences.map((c) => c.reference),
    [consequences]
  )

  const allThreatsExpanded =
    threats.length > 0 && threats.every((t) => threatOpenById[t.id] !== false)
  const allConsequencesExpanded =
    consequences.length > 0 &&
    consequences.every((c) => consequenceOpenById[c.id] !== false)

  const pickProbability = useCallback(
    (n: number) => {
      setSelectedProbability(n)
      const s = selectedSeverityRef.current
      if (s !== null) {
        appendHistory(`Event risk level was set to ${n}${s}`)
      }
    },
    [appendHistory]
  )

  const pickSeverity = useCallback(
    (letter: string) => {
      setSelectedSeverity(letter)
      const p = selectedProbabilityRef.current
      if (p !== null) {
        appendHistory(`Event risk level was set to ${p}${letter}`)
      }
    },
    [appendHistory]
  )

  const handleSaveInitialAssessment = useCallback(() => {
    if (selectedProbability === null || selectedSeverity === null) {
      toast.error("Önce olasılık (1–5) ve şiddet (E–A) seçin.")
      return
    }
    const code = `${selectedProbability}${selectedSeverity}`
    appendHistory(
      `Initial assessment was recorded as ${code} and set status to be mitigated`
    )
    toast.success(`İlk değerlendirme kaydedildi: ${code}`)
  }, [appendHistory, selectedProbability, selectedSeverity])

  const livePreviewCode = useMemo(() => {
    if (selectedProbability === null || selectedSeverity === null) return null
    return `${selectedProbability}${selectedSeverity}`
  }, [selectedProbability, selectedSeverity])

  const liveMatrixTone = useMemo((): RiskMatrixTone | null => {
    if (
      livePreviewCode === null ||
      selectedProbability === null ||
      selectedSeverity === null
    ) {
      return null
    }
    return riskMatrixToneFromSelection(selectedProbability, selectedSeverity)
  }, [livePreviewCode, selectedProbability, selectedSeverity])

  const barrierRecordRows = useMemo(() => {
    type Row = {
      key: string
      taskName: string
      source: string
      recordDate: string
      responsible: string
      dueDate: string
      status: string
    }
    const rows: Row[] = []
    const riskSource = `${displayTitle} (Risk)`
    for (const t of threats) {
      t.barriers.forEach((b, i) => {
        rows.push({
          key: `threat:${t.id}:${b.id}:${i}`,
          taskName: b.text,
          source: riskSource,
          recordDate: b.recordedAt || "—",
          responsible: "—",
          dueDate: "—",
          status: "Pending for Assignment",
        })
      })
    }
    for (const c of consequences) {
      c.barriers.forEach((b, i) => {
        rows.push({
          key: `cons:${c.id}:${b.id}:${i}`,
          taskName: b.text,
          source: riskSource,
          recordDate: b.recordedAt || "—",
          responsible: "—",
          dueDate: "—",
          status: "Pending for Assignment",
        })
      })
    }
    return rows
  }, [consequences, displayTitle, threats])

  const openCreateThreatForm = useCallback(() => {
    const ref = nextReference([...allThreatRefs, ...allConsequenceRefs])
    setThreatDialogMode("create")
    setThreatEditingId(null)
    setThreatForm({
      label: "",
      reference: ref,
      barriersText: "",
      fallbackNote: "",
    })
    setThreatDialogOpen(true)
  }, [allThreatRefs, allConsequenceRefs])

  const loadExistingRiskOptions = useCallback(async () => {
    setExistingRisksLoading(true)
    try {
      const res = await fetch("/api/safety/risk-options", {
        credentials: "include",
      })
      if (!res.ok) return
      const data = (await res.json()) as { options?: ExistingRiskOption[] }
      if (!Array.isArray(data.options)) return
      setExistingRiskOptions(data.options)
    } finally {
      setExistingRisksLoading(false)
    }
  }, [])

  const openCreateThreat = useCallback(() => {
    setThreatEntryMode("existing")
    setExistingRiskValue("")
    setThreatEntryOpen(true)
    void loadExistingRiskOptions()
  }, [loadExistingRiskOptions])

  const openEditThreat = useCallback((row: BoardRow) => {
    setThreatDialogMode("edit")
    setThreatEditingId(row.id)
    setThreatForm(rowToForm(row))
    setThreatDialogOpen(true)
  }, [])

  const saveThreatDialog = useCallback(() => {
    const label = threatForm.label.trim()
    if (!label) {
      toast.error("Threat başlığı gerekli.")
      return
    }
    let reference = threatForm.reference.trim()
    if (!reference) {
      reference = nextReference([
        ...threats.map((t) => t.reference),
        ...consequences.map((c) => c.reference),
      ])
    } else if (!reference.startsWith("#")) {
      reference = `#${reference}`
    }
    const prevBarriers =
      threatDialogMode === "edit" && threatEditingId
        ? threats.find((t) => t.id === threatEditingId)?.barriers ?? []
        : []
    const barriers = formToBarrierEntries(threatForm.barriersText, prevBarriers)
    const fallbackNote = threatForm.fallbackNote.trim()

    if (threatDialogMode === "create") {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? `t-${crypto.randomUUID()}`
          : `t-${Date.now()}`
      const n = threats.length + 1
      setThreats((prev) => [
        ...prev,
        { id, label, reference, barriers, fallbackNote },
      ])
      setThreatOpenById((prev) => ({ ...prev, [id]: true }))
      appendHistory(`New threat (${label}) was created as Threat #${n}`)
      for (const msg of describeBarrierDiffMessages(
        [],
        barriers,
        "Threat",
        label
      )) {
        appendHistory(msg)
      }
      toast.success("Threat eklendi.")
    } else if (threatEditingId) {
      const old = threats.find((t) => t.id === threatEditingId)
      setThreats((prev) =>
        prev.map((t) =>
          t.id === threatEditingId
            ? { ...t, label, reference, barriers, fallbackNote }
            : t
        )
      )
      if (old) {
        if (old.label !== label) {
          appendHistory(
            `Threat title was updated from "${old.label}" to "${label}"`
          )
        }
        if (old.reference !== reference) {
          appendHistory(
            `Threat "${label}" reference was updated from ${old.reference} to ${reference}`
          )
        }
        if (old.fallbackNote !== fallbackNote) {
          appendHistory(`Threat "${label}" description / fallback note was updated`)
        }
        for (const msg of describeBarrierDiffMessages(
          old.barriers,
          barriers,
          "Threat",
          label
        )) {
          appendHistory(msg)
        }
      }
      toast.success("Threat güncellendi.")
    }
    setThreatDialogOpen(false)
    setThreatEditingId(null)
  }, [
    appendHistory,
    threatDialogMode,
    threatEditingId,
    threatForm,
    threats,
    consequences,
  ])

  const connectExistingRiskAsThreat = useCallback(() => {
    if (!existingRiskValue) {
      toast.error("Önce listeden bir risk seçin.")
      return
    }
    const selected = existingRiskOptions.find((r) => r.id === existingRiskValue)
    if (!selected) {
      toast.error("Seçilen risk bulunamadı.")
      return
    }
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? `t-${crypto.randomUUID()}`
        : `t-${Date.now()}`
    const reference = nextReference([
      ...threats.map((t) => t.reference),
      ...consequences.map((c) => c.reference),
    ])
    setThreats((prev) => [
      ...prev,
      {
        id,
        label: selected.title,
        reference,
        barriers: [],
        fallbackNote: `Connected to existing risk ${selected.riskNo}`,
      },
    ])
    setThreatOpenById((prev) => ({ ...prev, [id]: true }))
    setThreatEntryOpen(false)
    setExistingRiskValue("")
    appendHistory(
      `Threat (${selected.title}) was connected from existing risk ${selected.riskNo}`
    )
    toast.success("Threat mevcut riskten bağlandı.")
  }, [
    appendHistory,
    existingRiskOptions,
    existingRiskValue,
    threats,
    consequences,
  ])

  const deleteThreat = useCallback((row: BoardRow) => {
    if (
      !window.confirm(
        `"${row.label}" tehdidini silmek istediğinize emin misiniz?`
      )
    ) {
      return
    }
    setThreats((prev) => prev.filter((t) => t.id !== row.id))
    setThreatOpenById((prev) => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
    appendHistory(
      `Threat "${row.label}" was deleted (reference ${row.reference})`
    )
    toast.success("Threat silindi.")
  }, [appendHistory])

  const registerThreatAsRisk = useCallback((row: BoardRow) => {
    toast.success(`"${row.label}" risk kaydına işlendi (önizleme).`, {
      description: `${row.reference} — ${displayTitle}`,
    })
  }, [displayTitle])

  const openCreateConsequenceForm = useCallback(() => {
    const ref = nextReference([...allThreatRefs, ...allConsequenceRefs])
    setConsequenceDialogMode("create")
    setConsequenceEditingId(null)
    setConsequenceForm({
      label: "",
      reference: ref,
      barriersText: "",
      fallbackNote: "",
    })
    setConsequenceDialogOpen(true)
  }, [allThreatRefs, allConsequenceRefs])

  const openCreateConsequence = useCallback(() => {
    setConsequenceEntryMode("existing")
    setExistingRiskValueForConsequence("")
    setConsequenceEntryOpen(true)
    void loadExistingRiskOptions()
  }, [loadExistingRiskOptions])

  const openEditConsequence = useCallback((row: BoardRow) => {
    setConsequenceDialogMode("edit")
    setConsequenceEditingId(row.id)
    setConsequenceForm(rowToForm(row))
    setConsequenceDialogOpen(true)
  }, [])

  const saveConsequenceDialog = useCallback(() => {
    const label = consequenceForm.label.trim()
    if (!label) {
      toast.error("Consequence başlığı gerekli.")
      return
    }
    let reference = consequenceForm.reference.trim()
    if (!reference) {
      reference = nextReference([
        ...threats.map((t) => t.reference),
        ...consequences.map((c) => c.reference),
      ])
    } else if (!reference.startsWith("#")) {
      reference = `#${reference}`
    }
    const prevConsBarriers =
      consequenceDialogMode === "edit" && consequenceEditingId
        ? consequences.find((c) => c.id === consequenceEditingId)?.barriers ??
          []
        : []
    const barriers = formToBarrierEntries(
      consequenceForm.barriersText,
      prevConsBarriers
    )
    const fallbackNote = consequenceForm.fallbackNote.trim()

    if (consequenceDialogMode === "create") {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? `c-${crypto.randomUUID()}`
          : `c-${Date.now()}`
      const n = consequences.length + 1
      setConsequences((prev) => [
        ...prev,
        { id, label, reference, barriers, fallbackNote },
      ])
      setConsequenceOpenById((prev) => ({ ...prev, [id]: true }))
      appendHistory(`New risk (${label}) was created as Consequence #${n}`)
      toast.success("Consequence eklendi.")
    } else if (consequenceEditingId) {
      setConsequences((prev) =>
        prev.map((c) =>
          c.id === consequenceEditingId
            ? { ...c, label, reference, barriers, fallbackNote }
            : c
        )
      )
      toast.success("Consequence güncellendi.")
    }
    setConsequenceDialogOpen(false)
    setConsequenceEditingId(null)
  }, [
    appendHistory,
    consequenceDialogMode,
    consequenceEditingId,
    consequenceForm,
    threats,
    consequences,
  ])

  const connectExistingRiskAsConsequence = useCallback(() => {
    if (!existingRiskValueForConsequence) {
      toast.error("Önce listeden bir risk seçin.")
      return
    }
    const selected = existingRiskOptions.find(
      (r) => r.id === existingRiskValueForConsequence
    )
    if (!selected) {
      toast.error("Seçilen risk bulunamadı.")
      return
    }
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? `c-${crypto.randomUUID()}`
        : `c-${Date.now()}`
    const reference = nextReference([
      ...threats.map((t) => t.reference),
      ...consequences.map((c) => c.reference),
    ])
    setConsequences((prev) => [
      ...prev,
      {
        id,
        label: selected.title,
        reference,
        barriers: [],
        fallbackNote: `Connected to existing risk ${selected.riskNo}`,
      },
    ])
    setConsequenceOpenById((prev) => ({ ...prev, [id]: true }))
    setConsequenceEntryOpen(false)
    setExistingRiskValueForConsequence("")
    appendHistory(
      `Consequence (${selected.title}) was connected from existing risk ${selected.riskNo}`
    )
    toast.success("Consequence mevcut riskten bağlandı.")
  }, [
    appendHistory,
    existingRiskOptions,
    existingRiskValueForConsequence,
    threats,
    consequences,
  ])

  const deleteConsequence = useCallback((row: BoardRow) => {
    if (
      !window.confirm(
        `"${row.label}" sonucunu silmek istediğinize emin misiniz?`
      )
    ) {
      return
    }
    setConsequences((prev) => prev.filter((c) => c.id !== row.id))
    setConsequenceOpenById((prev) => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
    appendHistory(
      `Consequence "${row.label}" was deleted (reference ${row.reference})`
    )
    toast.success("Consequence silindi.")
  }, [appendHistory])

  const registerConsequenceAsRisk = useCallback((row: BoardRow) => {
    toast.success(`"${row.label}" risk kaydına işlendi (önizleme).`, {
      description: `${row.reference} — ${displayTitle}`,
    })
  }, [displayTitle])

  const openBarrierDialog = useCallback(
    (kind: "threat" | "consequence", id: string) => {
      setBarrierTarget({ kind, id })
      setBarrierDraft("")
      setBarrierDialogOpen(true)
    },
    []
  )

  const saveBarrier = useCallback(() => {
    const text = barrierDraft.trim()
    if (!text) {
      toast.error("Bariyer metni boş olamaz.")
      return
    }
    if (!barrierTarget) return

    const entry: BarrierEntry = {
      id: newBarrierId(),
      text,
      recordedAt: ymdToday(),
    }
    const updater = (row: BoardRow): BoardRow => ({
      ...row,
      barriers: [...row.barriers, entry],
    })

    const parentLabel =
      barrierTarget.kind === "threat"
        ? threats.find((t) => t.id === barrierTarget.id)?.label ?? ""
        : consequences.find((c) => c.id === barrierTarget.id)?.label ?? ""
    const kindLabel = barrierTarget.kind === "threat" ? "Threat" : "Consequence"

    if (barrierTarget.kind === "threat") {
      setThreats((prev) =>
        prev.map((t) => (t.id === barrierTarget.id ? updater(t) : t))
      )
    } else {
      setConsequences((prev) =>
        prev.map((c) => (c.id === barrierTarget.id ? updater(c) : c))
      )
    }
    appendHistory(
      `Barrier "${text}" was added to ${kindLabel} "${parentLabel}"`
    )
    toast.success("Bariyer eklendi.")
    setBarrierDialogOpen(false)
    setBarrierTarget(null)
    setBarrierDraft("")
  }, [appendHistory, barrierDraft, barrierTarget, consequences, threats])

  const setThreatOpenAt = (id: string, open: boolean) => {
    setThreatOpenById((prev) => ({ ...prev, [id]: open }))
  }

  const setConsequenceOpenAt = (id: string, open: boolean) => {
    setConsequenceOpenById((prev) => ({ ...prev, [id]: open }))
  }

  const reportDateYmd = useMemo(() => ymdToday(), [displayTitle])

  const [printPortalReady, setPrintPortalReady] = useState(false)
  useEffect(() => {
    setPrintPortalReady(true)
  }, [])

  const printPreAssessmentLine = useMemo(() => {
    if (livePreviewCode === null || liveMatrixTone === null) return "—"
    return `${livePreviewCode} — ${printBandLabelForDoc(liveMatrixTone)}`
  }, [livePreviewCode, liveMatrixTone])

  const printRiskLevelLine = useMemo(
    () =>
      livePreviewCode
        ? `Risk Level: ${livePreviewCode}`
        : "Not selected probability and severity!",
    [livePreviewCode]
  )

  const handleRiskAssessmentPrint = useCallback(() => {
    document.body.classList.add("risk-assessment-printing")
    const cleanup = () => {
      document.body.classList.remove("risk-assessment-printing")
    }
    const onAfter = () => {
      cleanup()
      window.removeEventListener("afterprint", onAfter)
    }
    window.addEventListener("afterprint", onAfter)
    requestAnimationFrame(() => window.print())
    window.setTimeout(() => {
      cleanup()
      window.removeEventListener("afterprint", onAfter)
    }, 1200)
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto bg-muted/30 p-4 md:p-6">
      {riskTitle && riskTitle.trim().length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground"
            asChild
          >
            <Link href="/safety/risk-board">← Risk Board</Link>
          </Button>
          <span className="text-muted-foreground text-sm">Risk:</span>
          <span className="text-sm font-medium">{displayTitle}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="border-border bg-background"
          onClick={handleRiskAssessmentPrint}
        >
          <Printer className="size-4" />
          Print
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-muted/60 hover:bg-muted/60">
              <TableHead>Risk title</TableHead>
              <TableHead>Insertion date</TableHead>
              <TableHead>Inserted by</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Connected SPIs</TableHead>
              <TableHead>First assessment</TableHead>
              <TableHead>Final assessment</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-background hover:bg-background">
              <TableCell className="max-w-[200px] whitespace-normal font-medium">
                {displayTitle}
              </TableCell>
              <TableCell>{formatRiskDocDate(reportDateYmd)}</TableCell>
              <TableCell>{historyActor}</TableCell>
              <TableCell>Maintenance</TableCell>
              <TableCell>SPI-04, SPI-11</TableCell>
              <TableCell className="align-middle whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  {livePreviewCode && liveMatrixTone !== null ? (
                    <span
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-semibold tabular-nums",
                        firstAssessmentCellClass(liveMatrixTone)
                      )}
                    >
                      {formatRiskAssessmentWithBand(
                        selectedProbability!,
                        selectedSeverity!
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                  <StaticButton
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground shrink-0"
                  >
                    <SquarePen className="size-4" />
                  </StaticButton>
                </div>
              </TableCell>
              <TableCell>
                <StaticButton
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                >
                  <SquarePen className="size-4" />
                </StaticButton>
              </TableCell>
              <TableCell>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                  Open
                </span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:items-start">
        <Card className="border-sky-200/80 bg-card shadow-sm dark:border-sky-900/50">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-border py-4">
            <CardTitle className="text-base font-semibold">
              Potential causes
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="border-0 bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-700"
                onClick={openCreateThreat}
              >
                <Plus className="size-4" />
                Threat
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() =>
                setThreatOpenById(openMapForIds(threats.map((t) => t.id), !allThreatsExpanded))
              }
            >
              {allThreatsExpanded ? "Collapse all" : "Expand all"}
            </Button>

            {threats.map((row, index) => (
              <BoardCollapsibleRow
                key={row.id}
                variant="threat"
                item={row}
                index={index}
                open={threatOpenById[row.id] !== false}
                onOpenChange={(v) => setThreatOpenAt(row.id, v)}
                onRegisterAsRisk={() => registerThreatAsRisk(row)}
                onEdit={() => openEditThreat(row)}
                onDelete={() => deleteThreat(row)}
                onAddBarrier={() => openBarrierDialog("threat", row.id)}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="border-b border-border py-4 text-center">
            <CardTitle className="text-base font-semibold">Event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-900/50 dark:bg-amber-950/25">
              <p className="text-center text-sm font-bold text-amber-950 dark:text-amber-100">
                {displayTitle}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-muted-foreground">
              <p className="line-clamp-3">
                During walk-around, damage was observed on the right flap trailing
                edge. Aircraft grounded pending engineering assessment per SMS
                procedures.
              </p>
              <StaticButton
                variant="link"
                className="h-auto p-0 text-sky-600 dark:text-sky-400"
              >
                Show detail
              </StaticButton>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="flex w-full max-w-md flex-col items-center gap-2">
                <p className="text-center text-sm font-medium text-foreground">
                  Probability
                </p>
                <div className="flex w-full items-center justify-between gap-3 px-3 sm:gap-4 sm:px-5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <AssessmentMatrixButton
                      key={n}
                      selected={selectedProbability === n}
                      matrixTone={
                        liveMatrixTone !== null && selectedProbability === n
                          ? liveMatrixTone
                          : null
                      }
                      onClick={() => pickProbability(n)}
                    >
                      {n}
                    </AssessmentMatrixButton>
                  ))}
                </div>
              </div>

              <div className="flex w-full max-w-md flex-col items-center gap-2">
                <p className="text-center text-sm font-medium text-foreground">
                  Severity
                </p>
                <div className="flex w-full items-center justify-between gap-3 px-3 sm:gap-4 sm:px-5">
                  {["E", "D", "C", "B", "A"].map((l) => (
                    <AssessmentMatrixButton
                      key={l}
                      selected={selectedSeverity === l}
                      matrixTone={
                        liveMatrixTone !== null && selectedSeverity === l
                          ? liveMatrixTone
                          : null
                      }
                      onClick={() => pickSeverity(l)}
                    >
                      {l}
                    </AssessmentMatrixButton>
                  ))}
                </div>
              </div>

              <div
                className={cn(
                  "w-full max-w-md rounded-md px-4 py-3 text-center text-sm font-semibold",
                  liveMatrixTone !== null
                    ? MATRIX_BAR[liveMatrixTone]
                    : "bg-slate-600 text-white dark:bg-slate-700"
                )}
              >
                {livePreviewCode
                  ? `Risk Level: ${livePreviewCode}`
                  : "Not selected probability and severity!"}
              </div>

              <Button
                type="button"
                size="lg"
                onClick={handleSaveInitialAssessment}
                className="w-full max-w-md border-0 bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700"
              >
                Save initial assessment
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-200/80 bg-card shadow-sm dark:border-rose-900/50">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-border py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="border-0 bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700"
                onClick={openCreateConsequence}
              >
                <Plus className="size-4" />
                Consequence
              </Button>
            </div>
            <CardTitle className="text-base font-semibold">
              Potential outcomes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() =>
                setConsequenceOpenById(
                  openMapForIds(
                    consequences.map((c) => c.id),
                    !allConsequencesExpanded
                  )
                )
              }
            >
              {allConsequencesExpanded ? "Collapse all" : "Expand all"}
            </Button>

            {consequences.map((row, index) => (
              <BoardCollapsibleRow
                key={row.id}
                variant="consequence"
                item={row}
                index={index}
                open={consequenceOpenById[row.id] !== false}
                onOpenChange={(v) => setConsequenceOpenAt(row.id, v)}
                onRegisterAsRisk={() => registerConsequenceAsRisk(row)}
                onEdit={() => openEditConsequence(row)}
                onDelete={() => deleteConsequence(row)}
                onAddBarrier={() => openBarrierDialog("consequence", row.id)}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Barrier records
        </h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-muted/60 hover:bg-muted/60">
                <TableHead>Task name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Record date</TableHead>
                <TableHead>Responsible</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {barrierRecordRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground h-16 text-center text-sm"
                  >
                    No barrier records yet. Add a barrier under a threat or
                    consequence above.
                  </TableCell>
                </TableRow>
              ) : (
                barrierRecordRows.map((r) => (
                  <TableRow key={r.key} className="bg-background hover:bg-muted/30">
                    <TableCell className="max-w-[220px] whitespace-normal font-medium">
                      {r.taskName}
                    </TableCell>
                    <TableCell className="whitespace-normal text-sm">
                      {r.source}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm tabular-nums">
                      {r.recordDate}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.responsible}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm tabular-nums">
                      {r.dueDate}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "rounded-full border-0 px-2.5 py-0.5 text-xs font-medium text-white",
                          r.status === "Pending for Assignment" &&
                            "bg-violet-600 hover:bg-violet-600"
                        )}
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-[#E9ECEF] p-4 dark:border-muted dark:bg-muted/50">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Clock className="size-4 shrink-0 text-muted-foreground" />
          History
        </div>
        {history.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            Henüz geçmiş yok. Olay (risk seviyesi) değişiklikleri, threat /
            consequence ekleme-düzenleme-silme, bariyer CRUD ve ilk değerlendirme
            kaydı burada görünür; her satırda işlemi yapan kullanıcı adı yer alır.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-foreground">
            {history.map((entry) => (
              <li key={entry.id} className="leading-snug">
                <span className="tabular-nums text-muted-foreground">
                  {entry.date}
                </span>
                {" — "}
                {entry.message} by {entry.actor ?? "Bilinmiyor"}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={threatEntryOpen}
        onOpenChange={(open) => {
          setThreatEntryOpen(open)
          if (!open) {
            setThreatEntryMode("existing")
            setExistingRiskValue("")
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
          <div className="flex items-center justify-between border-b pb-3">
            <DialogTitle className="text-2xl font-semibold">
              Create A Potential Causes Threat
            </DialogTitle>
            <Button
              type="button"
              variant="ghost"
              className="h-9 w-9 rounded-md bg-rose-100/70 text-rose-700 hover:bg-rose-200/80"
              onClick={() => setThreatEntryOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-lg">
              <input
                type="radio"
                name="threat-entry-mode"
                value="existing"
                checked={threatEntryMode === "existing"}
                onChange={() => setThreatEntryMode("existing")}
              />
              Connect to an existing risk
            </label>
            <label className="flex items-center gap-2 text-lg">
              <input
                type="radio"
                name="threat-entry-mode"
                value="new"
                checked={threatEntryMode === "new"}
                onChange={() => setThreatEntryMode("new")}
              />
              Create a New One
            </label>
          </div>

          {threatEntryMode === "existing" ? (
            <div className="space-y-3 border-t pt-3">
              <Select
                value={existingRiskValue}
                onValueChange={(v) => setExistingRiskValue(v)}
                disabled={existingRisksLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      existingRisksLoading ? "Loading risks..." : "Select a risk..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {existingRiskOptions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.riskNo} — {r.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="bg-sky-500 text-white hover:bg-sky-600"
                  onClick={connectExistingRiskAsThreat}
                >
                  Connect
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end border-t pt-3">
              <Button
                type="button"
                className="bg-sky-600 text-white hover:bg-sky-700"
                onClick={() => {
                  setThreatEntryOpen(false)
                  openCreateThreatForm()
                }}
              >
                Continue
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={threatDialogOpen}
        onOpenChange={(o) => {
          setThreatDialogOpen(o)
          if (!o) setThreatEditingId(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {threatDialogMode === "create" ? "New threat" : "Edit threat"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="threat-label">Threat name</Label>
              <Input
                id="threat-label"
                value={threatForm.label}
                onChange={(e) =>
                  setThreatForm((f) => ({ ...f, label: e.target.value }))
                }
                placeholder="e.g. Equipment failure"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="threat-ref">Reference</Label>
              <Input
                id="threat-ref"
                value={threatForm.reference}
                onChange={(e) =>
                  setThreatForm((f) => ({ ...f, reference: e.target.value }))
                }
                placeholder="#10992"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="threat-barriers">Barriers (one per line)</Label>
              <Textarea
                id="threat-barriers"
                value={threatForm.barriersText}
                onChange={(e) =>
                  setThreatForm((f) => ({ ...f, barriersText: e.target.value }))
                }
                placeholder="Each line becomes a separate barrier box"
                className="min-h-[88px]"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="threat-fallback">Description (if no barriers)</Label>
              <Textarea
                id="threat-fallback"
                value={threatForm.fallbackNote}
                onChange={(e) =>
                  setThreatForm((f) => ({ ...f, fallbackNote: e.target.value }))
                }
                placeholder="Shown when barrier list is empty"
                className="min-h-[72px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setThreatDialogOpen(false)
                setThreatEditingId(null)
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveThreatDialog}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={consequenceEntryOpen}
        onOpenChange={(open) => {
          setConsequenceEntryOpen(open)
          if (!open) {
            setConsequenceEntryMode("existing")
            setExistingRiskValueForConsequence("")
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
          <div className="flex items-center justify-between border-b pb-3">
            <DialogTitle className="text-2xl font-semibold">
              Create A Potential Outcomes Consequence
            </DialogTitle>
            <Button
              type="button"
              variant="ghost"
              className="h-9 w-9 rounded-md bg-rose-100/70 text-rose-700 hover:bg-rose-200/80"
              onClick={() => setConsequenceEntryOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-lg">
              <input
                type="radio"
                name="consequence-entry-mode"
                value="existing"
                checked={consequenceEntryMode === "existing"}
                onChange={() => setConsequenceEntryMode("existing")}
              />
              Connect to an existing risk
            </label>
            <label className="flex items-center gap-2 text-lg">
              <input
                type="radio"
                name="consequence-entry-mode"
                value="new"
                checked={consequenceEntryMode === "new"}
                onChange={() => setConsequenceEntryMode("new")}
              />
              Create a New One
            </label>
          </div>

          {consequenceEntryMode === "existing" ? (
            <div className="space-y-3 border-t pt-3">
              <Select
                value={existingRiskValueForConsequence}
                onValueChange={(v) => setExistingRiskValueForConsequence(v)}
                disabled={existingRisksLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      existingRisksLoading ? "Loading risks..." : "Select a risk..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {existingRiskOptions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.riskNo} — {r.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="bg-rose-600 text-white hover:bg-rose-700"
                  onClick={connectExistingRiskAsConsequence}
                >
                  Connect
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end border-t pt-3">
              <Button
                type="button"
                className="bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => {
                  setConsequenceEntryOpen(false)
                  openCreateConsequenceForm()
                }}
              >
                Continue
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={consequenceDialogOpen}
        onOpenChange={(o) => {
          setConsequenceDialogOpen(o)
          if (!o) setConsequenceEditingId(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {consequenceDialogMode === "create"
                ? "New consequence"
                : "Edit consequence"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="cons-label">Consequence name</Label>
              <Input
                id="cons-label"
                value={consequenceForm.label}
                onChange={(e) =>
                  setConsequenceForm((f) => ({ ...f, label: e.target.value }))
                }
                placeholder="e.g. Structural damage"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cons-ref">Reference</Label>
              <Input
                id="cons-ref"
                value={consequenceForm.reference}
                onChange={(e) =>
                  setConsequenceForm((f) => ({ ...f, reference: e.target.value }))
                }
                placeholder="#10995"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cons-barriers">Barriers (one per line)</Label>
              <Textarea
                id="cons-barriers"
                value={consequenceForm.barriersText}
                onChange={(e) =>
                  setConsequenceForm((f) => ({
                    ...f,
                    barriersText: e.target.value,
                  }))
                }
                className="min-h-[88px]"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cons-fallback">Description (if no barriers)</Label>
              <Textarea
                id="cons-fallback"
                value={consequenceForm.fallbackNote}
                onChange={(e) =>
                  setConsequenceForm((f) => ({
                    ...f,
                    fallbackNote: e.target.value,
                  }))
                }
                className="min-h-[72px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConsequenceDialogOpen(false)
                setConsequenceEditingId(null)
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveConsequenceDialog}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={barrierDialogOpen}
        onOpenChange={(o) => {
          setBarrierDialogOpen(o)
          if (!o) {
            setBarrierTarget(null)
            setBarrierDraft("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add barrier</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="barrier-text">Barrier text</Label>
            <Textarea
              id="barrier-text"
              value={barrierDraft}
              onChange={(e) => setBarrierDraft(e.target.value)}
              placeholder="Describe the barrier…"
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBarrierDialogOpen(false)
                setBarrierTarget(null)
                setBarrierDraft("")
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveBarrier}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {printPortalReady
        ? createPortal(
            <RiskAssessmentPrintDocument
              displayTitle={displayTitle}
              insertionYmd={reportDateYmd}
              revisionYmd={reportDateYmd}
              insertedBy={historyActor}
              resource="Maintenance"
              connectedSpis="SPI-04, SPI-11"
              preAssessmentLine={printPreAssessmentLine}
              preAssessmentTone={liveMatrixTone}
              postAssessmentLine=""
              statusLabel="Awaiting mitigation"
              threats={threats}
              consequences={consequences}
              selectedProbability={selectedProbability}
              selectedSeverity={selectedSeverity}
              livePreviewCode={livePreviewCode}
              liveMatrixTone={liveMatrixTone}
              riskLevelLine={printRiskLevelLine}
              barrierRecordRows={barrierRecordRows}
              history={history}
              historyActor={historyActor}
            />,
            document.body
          )
        : null}
    </div>
  )
}
