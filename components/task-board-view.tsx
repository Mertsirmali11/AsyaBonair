"use client"

import Link from "next/link"
import { useState, type ComponentProps, type ReactNode } from "react"
import {
  ChevronDown,
  Info,
  Pencil,
  Plus,
  Printer,
  SquarePen,
  Trash2,
} from "lucide-react"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

function MatrixButton({ children }: { children: ReactNode }) {
  return (
    <StaticButton
      variant="outline"
      size="sm"
      className="size-9 min-w-9 shrink-0 rounded-md border-border p-0 font-semibold text-muted-foreground"
    >
      {children}
    </StaticButton>
  )
}

function toggleAllFlags(prev: boolean[], expand: boolean) {
  return prev.map(() => expand)
}

const DEFAULT_EVENT_TITLE = "TC-IHY — Right flap trailing edge damage"

export function TaskBoardView({
  riskTitle,
}: {
  riskTitle?: string | null
}) {
  const displayTitle =
    riskTitle && riskTitle.trim().length > 0
      ? riskTitle.trim()
      : DEFAULT_EVENT_TITLE

  const [threatOpens, setThreatOpens] = useState([true, true])
  const [consequenceOpens, setConsequenceOpens] = useState([true, true])

  const allThreatsExpanded =
    threatOpens.length > 0 && threatOpens.every(Boolean)
  const allConsequencesExpanded =
    consequenceOpens.length > 0 && consequenceOpens.every(Boolean)

  const setThreatAt = (index: number, open: boolean) => {
    setThreatOpens((prev) => prev.map((v, i) => (i === index ? open : v)))
  }
  const setConsequenceAt = (index: number, open: boolean) => {
    setConsequenceOpens((prev) => prev.map((v, i) => (i === index ? open : v)))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto bg-muted/30 p-4 md:p-6">
      {riskTitle && riskTitle.trim().length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" asChild>
            <Link href="/safety/risk-board">← Risk Board</Link>
          </Button>
          <span className="text-muted-foreground text-sm">Risk:</span>
          <span className="text-sm font-medium">{displayTitle}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <StaticButton variant="outline" size="lg" className="border-border bg-background">
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
                <StaticButton variant="ghost" size="icon-sm" className="text-muted-foreground">
                  <SquarePen className="size-4" />
                </StaticButton>
              </TableCell>
              <TableCell>
                <StaticButton variant="ghost" size="icon-sm" className="text-muted-foreground">
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
            <CardTitle className="text-base font-semibold">Potential causes</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <StaticButton
                size="sm"
                className="border-0 bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-700"
              >
                <Plus className="size-4" />
                Threat
              </StaticButton>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() =>
                setThreatOpens((prev) =>
                  toggleAllFlags(prev, !allThreatsExpanded)
                )
              }
            >
              {allThreatsExpanded ? "Collapse all" : "Expand all"}
            </Button>

            <Collapsible
              open={threatOpens[0]}
              onOpenChange={(v) => setThreatAt(0, v)}
              className="rounded-lg border border-sky-200 bg-sky-50/80 dark:border-sky-900/60 dark:bg-sky-950/20"
            >
              <div className="flex w-full items-stretch border-b border-sky-200/80 dark:border-sky-900/50">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="group flex min-w-0 flex-1 items-start gap-2 px-3 py-3 text-left transition-colors hover:bg-sky-100/80 dark:hover:bg-sky-950/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        1. Threat — Equipment failure
                      </p>
                      <p className="text-xs text-muted-foreground">#10992</p>
                    </div>
                    <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
                <div className="flex shrink-0 items-center pr-2">
                  <StaticButton variant="ghost" size="icon-sm" className="size-8">
                    <Info className="size-4" />
                  </StaticButton>
                </div>
              </div>
              <CollapsibleContent>
                <div className="space-y-3 p-3">
                  <div className="flex flex-wrap gap-2">
                    <StaticButton
                      size="sm"
                      className="border-0 bg-sky-500 text-white hover:bg-sky-600"
                    >
                      <Plus className="size-3.5" />
                      Register as risk
                    </StaticButton>
                    <StaticButton
                      size="sm"
                      className="border-0 bg-[#2d3748] text-white hover:bg-[#1e293b]"
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </StaticButton>
                    <StaticButton size="sm" variant="destructive">
                      <Trash2 className="size-3.5" />
                      Delete
                    </StaticButton>
                  </div>
                  <StaticButton
                    size="sm"
                    className="border-0 bg-[#2d3748] text-white hover:bg-[#1e293b]"
                  >
                    <Plus className="size-3.5" />
                    Barrier
                  </StaticButton>
                  <div className="rounded-md border border-sky-200/80 bg-sky-100/50 px-3 py-2.5 text-sm text-foreground dark:border-sky-900/50 dark:bg-sky-950/30">
                    Periodic maintenance and pre-operational daily checks.
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible
              open={threatOpens[1]}
              onOpenChange={(v) => setThreatAt(1, v)}
              className="rounded-lg border border-sky-200 bg-sky-50/80 dark:border-sky-900/60 dark:bg-sky-950/20"
            >
              <div className="flex w-full items-stretch border-b border-sky-200/80 dark:border-sky-900/50">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="group flex min-w-0 flex-1 items-start gap-2 px-3 py-3 text-left transition-colors hover:bg-sky-100/80 dark:hover:bg-sky-950/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        2. Threat — Human factors
                      </p>
                      <p className="text-xs text-muted-foreground">#11001</p>
                    </div>
                    <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
                <div className="flex shrink-0 items-center pr-2">
                  <StaticButton variant="ghost" size="icon-sm" className="size-8">
                    <Info className="size-4" />
                  </StaticButton>
                </div>
              </div>
              <CollapsibleContent>
                <div className="space-y-3 p-3">
                  <div className="rounded-md border border-sky-200/80 bg-sky-100/50 px-3 py-2.5 text-sm text-foreground dark:border-sky-900/50 dark:bg-sky-950/30">
                    Time pressure, fatigue, and communication gaps during line operations.
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
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
                During walk-around, damage was observed on the right flap trailing edge. Aircraft
                grounded pending engineering assessment per SMS procedures.
              </p>
              <StaticButton variant="link" className="h-auto p-0 text-sky-600 dark:text-sky-400">
                Show detail
              </StaticButton>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Probability</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <MatrixButton key={n}>{n}</MatrixButton>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Severity</p>
              <div className="flex flex-wrap gap-2">
                {["E", "D", "C", "B", "A"].map((l) => (
                  <MatrixButton key={l}>{l}</MatrixButton>
                ))}
              </div>
            </div>

            <div className="rounded-md bg-[#2d3748] px-3 py-3 text-center text-sm font-medium text-white dark:bg-[#1e293b]">
              Not selected probability and severity.
            </div>

            <StaticButton
              size="lg"
              className="w-full border-0 bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700"
            >
              Save initial assessment
            </StaticButton>
          </CardContent>
        </Card>

        <Card className="border-rose-200/80 bg-card shadow-sm dark:border-rose-900/50">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-border py-4">
            <div className="flex flex-wrap items-center gap-2">
              <StaticButton
                size="sm"
                className="border-0 bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700"
              >
                <Plus className="size-4" />
                Consequence
              </StaticButton>
            </div>
            <CardTitle className="text-base font-semibold">Potential outcomes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() =>
                setConsequenceOpens((prev) =>
                  toggleAllFlags(prev, !allConsequencesExpanded)
                )
              }
            >
              {allConsequencesExpanded ? "Collapse all" : "Expand all"}
            </Button>

            <Collapsible
              open={consequenceOpens[0]}
              onOpenChange={(v) => setConsequenceAt(0, v)}
              className="rounded-lg border border-rose-200 bg-rose-50/80 dark:border-rose-900/50 dark:bg-rose-950/20"
            >
              <div className="flex w-full items-stretch">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="group flex min-w-0 flex-1 items-start gap-2 px-3 py-3 text-left transition-colors hover:bg-rose-100/80 dark:hover:bg-rose-950/40"
                  >
                    <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        1. Consequence — Structural damage
                      </p>
                      <p className="text-xs text-muted-foreground">#10995</p>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <div className="flex shrink-0 items-center pr-2">
                  <StaticButton variant="ghost" size="icon-sm" className="size-8">
                    <Info className="size-4" />
                  </StaticButton>
                </div>
              </div>
              <CollapsibleContent>
                <div className="border-t border-rose-200/80 px-3 py-3 text-sm text-muted-foreground dark:border-rose-900/50">
                  Further consequences can be linked here (preview).
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible
              open={consequenceOpens[1]}
              onOpenChange={(v) => setConsequenceAt(1, v)}
              className="rounded-lg border border-rose-200 bg-rose-50/80 dark:border-rose-900/50 dark:bg-rose-950/20"
            >
              <div className="flex w-full items-stretch">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="group flex min-w-0 flex-1 items-start gap-2 px-3 py-3 text-left transition-colors hover:bg-rose-100/80 dark:hover:bg-rose-950/40"
                  >
                    <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        2. Consequence — Operational disruption
                      </p>
                      <p className="text-xs text-muted-foreground">#10998</p>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <div className="flex shrink-0 items-center pr-2">
                  <StaticButton variant="ghost" size="icon-sm" className="size-8">
                    <Info className="size-4" />
                  </StaticButton>
                </div>
              </div>
              <CollapsibleContent>
                <div className="border-t border-rose-200/80 px-3 py-3 text-sm text-muted-foreground dark:border-rose-900/50">
                  Delays, cancellations, or fleet availability impact if damage propagates.
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div
              className={cn(
                "flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-rose-200/80 bg-rose-50/30 text-sm text-muted-foreground",
                "dark:border-rose-900/40 dark:bg-rose-950/10"
              )}
            >
              Drop zone for additional outcomes
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
