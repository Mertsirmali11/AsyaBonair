"use client"

import Link from "next/link"
import { useCallback, useMemo, useState, type ComponentProps, type ReactNode } from "react"
import {
  ChevronDown,
  Info,
  Pencil,
  Plus,
  Printer,
  SquarePen,
  Trash2,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
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

function AssessmentMatrixButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant={selected ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className={cn(
        "size-9 min-w-9 shrink-0 rounded-md p-0 font-semibold",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
          : "border-border text-muted-foreground hover:bg-muted/60"
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

type BoardRow = {
  id: string
  /** Metin: "Equipment failure" → başlıkta "1. Threat — Equipment failure" */
  label: string
  reference: string
  barriers: string[]
  /** Bariyer yoksa kutuda gösterilen açıklama */
  fallbackNote: string
}

const INITIAL_THREATS: BoardRow[] = [
  {
    id: "t-1",
    label: "Equipment failure",
    reference: "#10992",
    barriers: ["Periodic maintenance and pre-operational daily checks."],
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

  const contentBlocks =
    item.barriers.length > 0
      ? item.barriers
      : item.fallbackNote.trim().length > 0
        ? [item.fallbackNote.trim()]
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
          {contentBlocks.map((text, i) => (
            <div
              key={`${item.id}-block-${i}`}
              className={cn("rounded-md border px-3 py-2.5 text-sm text-foreground", boxBorder)}
            >
              {text}
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
    barriersText: row.barriers.join("\n"),
    fallbackNote: row.fallbackNote,
  }
}

function formToBarriers(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function TaskBoardView({
  riskTitle,
}: {
  riskTitle?: string | null
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
  const [savedRiskLevel, setSavedRiskLevel] = useState<string | null>(null)

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

  const pickProbability = useCallback((n: number) => {
    setSelectedProbability(n)
    setSavedRiskLevel(null)
  }, [])

  const pickSeverity = useCallback((letter: string) => {
    setSelectedSeverity(letter)
    setSavedRiskLevel(null)
  }, [])

  const handleSaveInitialAssessment = useCallback(() => {
    if (selectedProbability === null || selectedSeverity === null) {
      toast.error("Önce olasılık (1–5) ve şiddet (E–A) seçin.")
      return
    }
    const code = `${selectedProbability}${selectedSeverity}`
    setSavedRiskLevel(code)
    toast.success(`İlk değerlendirme kaydedildi: ${code}`)
  }, [selectedProbability, selectedSeverity])

  const openCreateThreat = useCallback(() => {
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
    const barriers = formToBarriers(threatForm.barriersText)
    const fallbackNote = threatForm.fallbackNote.trim()

    if (threatDialogMode === "create") {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? `t-${crypto.randomUUID()}`
          : `t-${Date.now()}`
      setThreats((prev) => [
        ...prev,
        { id, label, reference, barriers, fallbackNote },
      ])
      setThreatOpenById((prev) => ({ ...prev, [id]: true }))
      toast.success("Threat eklendi.")
    } else if (threatEditingId) {
      setThreats((prev) =>
        prev.map((t) =>
          t.id === threatEditingId
            ? { ...t, label, reference, barriers, fallbackNote }
            : t
        )
      )
      toast.success("Threat güncellendi.")
    }
    setThreatDialogOpen(false)
    setThreatEditingId(null)
  }, [threatDialogMode, threatEditingId, threatForm, threats, consequences])

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
    toast.success("Threat silindi.")
  }, [])

  const registerThreatAsRisk = useCallback((row: BoardRow) => {
    toast.success(`"${row.label}" risk kaydına işlendi (önizleme).`, {
      description: `${row.reference} — ${displayTitle}`,
    })
  }, [displayTitle])

  const openCreateConsequence = useCallback(() => {
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
    const barriers = formToBarriers(consequenceForm.barriersText)
    const fallbackNote = consequenceForm.fallbackNote.trim()

    if (consequenceDialogMode === "create") {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? `c-${crypto.randomUUID()}`
          : `c-${Date.now()}`
      setConsequences((prev) => [
        ...prev,
        { id, label, reference, barriers, fallbackNote },
      ])
      setConsequenceOpenById((prev) => ({ ...prev, [id]: true }))
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
    consequenceDialogMode,
    consequenceEditingId,
    consequenceForm,
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
    toast.success("Consequence silindi.")
  }, [])

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

    const updater = (row: BoardRow): BoardRow => ({
      ...row,
      barriers: [...row.barriers, text],
    })

    if (barrierTarget.kind === "threat") {
      setThreats((prev) =>
        prev.map((t) => (t.id === barrierTarget.id ? updater(t) : t))
      )
    } else {
      setConsequences((prev) =>
        prev.map((c) => (c.id === barrierTarget.id ? updater(c) : c))
      )
    }
    toast.success("Bariyer eklendi.")
    setBarrierDialogOpen(false)
    setBarrierTarget(null)
    setBarrierDraft("")
  }, [barrierDraft, barrierTarget])

  const setThreatOpenAt = (id: string, open: boolean) => {
    setThreatOpenById((prev) => ({ ...prev, [id]: open }))
  }

  const setConsequenceOpenAt = (id: string, open: boolean) => {
    setConsequenceOpenById((prev) => ({ ...prev, [id]: open }))
  }

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
        <StaticButton
          variant="outline"
          size="lg"
          className="border-border bg-background"
        >
          <Printer className="size-4" />
          Print
        </StaticButton>
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
              <TableCell>12 Mar 2026</TableCell>
              <TableCell>J. Yılmaz</TableCell>
              <TableCell>Maintenance</TableCell>
              <TableCell>SPI-04, SPI-11</TableCell>
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
                      onClick={() => pickSeverity(l)}
                    >
                      {l}
                    </AssessmentMatrixButton>
                  ))}
                </div>
              </div>

              <div
                className={cn(
                  "flex w-full max-w-md flex-wrap items-center justify-between gap-3 rounded-md px-4 py-3",
                  "bg-slate-600 text-white dark:bg-slate-700"
                )}
              >
                <span className="text-sm font-medium">Risk Level:</span>
                <span className="rounded-full bg-slate-200/95 px-3 py-1 text-center text-xs font-semibold tracking-wide text-slate-800 dark:bg-slate-300/95 dark:text-slate-900">
                  {savedRiskLevel ??
                    "Not selected probability and severity!"}
                </span>
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
    </div>
  )
}
