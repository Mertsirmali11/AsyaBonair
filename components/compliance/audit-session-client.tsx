"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  HelpCircle,
  Minus,
  Save,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type ChecklistItem = {
  id: number
  label: string
  sortOrder: number
  isRequired: boolean
  isHeading: boolean
  reference?: string | null
  section?: string | null
}

type SessionItem = {
  id: number
  auditSessionId: number
  auditChecklistItemId: number
  result: string | null
  notes: string | null
}

type AssignedChecklist = {
  assignmentId: number
  checklistId: number
  title: string
  checklistNumber: string | null
  itemCount: number
}

type AuditEntryData = {
  id: string
  auditNumber: string
  field: string
  status: string
  assignedChecklists: AssignedChecklist[]
}

type AuditSession = {
  id: number
  auditPlanEntryId: number
  auditChecklistId: number
  status: string
  checklist: { id: number; title: string; checklistNumber: string | null; items: ChecklistItem[] }
  items: SessionItem[]
}

type ResultType = "S" | "U" | "NA" | ""

const resultConfig: Record<string, { label: string; icon: React.ReactNode; cls: string; bg: string }> = {
  S: {
    label: "Satisfactory",
    icon: <CheckCircle2 className="size-4" />,
    cls: "text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:border-emerald-700 dark:bg-emerald-950/40",
    bg: "bg-emerald-50/60 dark:bg-emerald-950/20",
  },
  U: {
    label: "Unsatisfactory",
    icon: <XCircle className="size-4" />,
    cls: "text-red-700 border-red-300 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:border-red-700 dark:bg-red-950/40",
    bg: "bg-red-50/60 dark:bg-red-950/20",
  },
  NA: {
    label: "N/A",
    icon: <Minus className="size-4" />,
    cls: "text-slate-600 border-slate-300 bg-slate-50 hover:bg-slate-100 dark:text-slate-400 dark:border-slate-600 dark:bg-slate-900/40",
    bg: "bg-slate-50/40 dark:bg-slate-900/20",
  },
}

async function parseJson(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try { return JSON.parse(t) as unknown } catch { return null }
}

export function AuditSessionClient({ auditPlanEntryId }: { auditPlanEntryId: number }) {
  const router = useRouter()
  const [entry, setEntry] = React.useState<AuditEntryData | null>(null)
  const [session, setSession] = React.useState<AuditSession | null>(null)
  const [selectedChecklistId, setSelectedChecklistId] = React.useState<number | null>(null)
  const [results, setResults] = React.useState<Record<number, ResultType>>({})
  const [notes, setNotes] = React.useState<Record<number, string>>({})
  const [savingItem, setSavingItem] = React.useState<number | null>(null)
  const [completing, setCompleting] = React.useState(false)
  const [confirmComplete, setConfirmComplete] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  // Load audit plan entry details
  const loadEntry = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/audit-plan/${auditPlanEntryId}`, { cache: "no-store" })
      const data = await parseJson(res)
      if (!res.ok || !data) { toast.error("Denetim planı yüklenemedi."); return }
      setEntry(data as AuditEntryData)
    } catch {
      toast.error("Yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [auditPlanEntryId])

  React.useEffect(() => { void loadEntry() }, [loadEntry])

  // Auto-select first checklist
  React.useEffect(() => {
    if (entry && entry.assignedChecklists.length > 0 && selectedChecklistId === null) {
      setSelectedChecklistId(entry.assignedChecklists[0].checklistId)
    }
  }, [entry, selectedChecklistId])

  // Start or load session when checklist is selected
  const startSession = React.useCallback(async (checklistId: number) => {
    try {
      const res = await fetch("/api/audit-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditPlanEntryId, auditChecklistId: checklistId }),
      })
      const data = await parseJson(res)
      if (!res.ok) { toast.error("Oturum başlatılamadı."); return }
      const sess = data as AuditSession
      setSession(sess)
      // Load existing results
      const resultMap: Record<number, ResultType> = {}
      const notesMap: Record<number, string> = {}
      for (const item of sess.items) {
        resultMap[item.auditChecklistItemId] = (item.result ?? "") as ResultType
        notesMap[item.auditChecklistItemId] = item.notes ?? ""
      }
      setResults(resultMap)
      setNotes(notesMap)
    } catch {
      toast.error("Bağlantı hatası.")
    }
  }, [auditPlanEntryId])

  React.useEffect(() => {
    if (selectedChecklistId !== null) {
      void startSession(selectedChecklistId)
    }
  }, [selectedChecklistId, startSession])

  const setResult = async (itemId: number, result: ResultType) => {
    if (!session) return
    setResults((prev) => ({ ...prev, [itemId]: result }))
    setSavingItem(itemId)
    try {
      await fetch(`/api/audit-sessions/${session.id}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditChecklistItemId: itemId,
          result: result || null,
          notes: notes[itemId] ?? null,
        }),
      })
    } catch {
      toast.error("Kaydedilemedi.")
    } finally {
      setSavingItem(null)
    }
  }

  const saveNotes = async (itemId: number) => {
    if (!session) return
    setSavingItem(itemId)
    try {
      await fetch(`/api/audit-sessions/${session.id}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditChecklistItemId: itemId,
          result: results[itemId] || null,
          notes: notes[itemId] ?? null,
        }),
      })
    } catch {
      toast.error("Not kaydedilemedi.")
    } finally {
      setSavingItem(null)
    }
  }

  const completeSession = async () => {
    if (!session) return
    setCompleting(true)
    try {
      const res = await fetch(`/api/audit-sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      })
      if (!res.ok) { toast.error("Tamamlanamadı."); return }
      toast.success("Denetim tamamlandı. Bulgular oluşturuldu.")
      router.push(`/compliance/audit-plan`)
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setCompleting(false)
      setConfirmComplete(false)
    }
  }

  const items = session?.checklist?.items ?? []
  const questionItems = items.filter((it) => !it.isHeading)
  const answeredCount = questionItems.filter((it) => results[it.id]).length
  const unsatisfactoryCount = questionItems.filter((it) => results[it.id] === "U").length

  // Group items under headings
  let questionNumber = 0

  return (
    <TooltipProvider>
      <SetWorkspacePageTitle title="Denetim Yürüt" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Breadcrumb */}
        <Breadcrumb className="text-xs sm:text-sm">
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/dashboard">Dashboard</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/compliance">Compliance Monitoring</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/compliance/audit-plan">Audit Plan</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Denetim Yürüt</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" asChild>
              <Link href="/compliance/audit-plan"><ArrowLeft className="size-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                <ClipboardCheck className="size-5 text-emerald-600" />
                {loading ? "Yükleniyor…" : entry ? `Denetim — ${entry.field}` : "Denetim"}
              </h1>
              {entry && (
                <p className="text-muted-foreground text-sm mt-0.5">
                  {entry.auditNumber}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {session && session.status !== "Completed" && (
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setConfirmComplete(true)}
              >
                <CheckCircle2 className="mr-1.5 size-4" />
                Denetimi Tamamla
              </Button>
            )}
            {session?.status === "Completed" && (
              <Badge className="bg-teal-600 text-white">Tamamlandı</Badge>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {session && questionItems.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-full bg-muted h-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${(answeredCount / questionItems.length) * 100}%` }}
              />
            </div>
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              {answeredCount}/{questionItems.length} yanıtlandı
              {unsatisfactoryCount > 0 && (
                <span className="ml-2 text-red-600 font-medium">
                  · {unsatisfactoryCount} bulgu
                </span>
              )}
            </span>
          </div>
        )}

        {/* Checklist selector */}
        {entry && entry.assignedChecklists.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium shrink-0">Checklist:</span>
            <Select
              value={String(selectedChecklistId)}
              onValueChange={(v) => setSelectedChecklistId(Number(v))}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {entry.assignedChecklists.map((a) => (
                  <SelectItem key={a.checklistId} value={String(a.checklistId)}>
                    {a.checklistNumber ?? `CL-${a.checklistId}`} — {a.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* No checklists assigned */}
        {!loading && entry && entry.assignedChecklists.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="inline mr-2 size-4" />
            Bu denetim planına checklist atanmamış. Önce Audit Plan'dan bir checklist atayın.
          </div>
        )}

        {/* Checklist items */}
        {session && items.length > 0 && (
          <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
            <ScrollArea className="h-[min(65vh,700px)]">
              <div className="divide-y">
                {items.map((item) => {
                  if (item.isHeading) {
                    return (
                      <div
                        key={item.id}
                        className="px-4 py-3 bg-amber-50/80 dark:bg-amber-950/30 border-l-4 border-l-amber-400"
                      >
                        <p className="font-semibold text-amber-900 dark:text-amber-200">
                          {item.label}
                        </p>
                      </div>
                    )
                  }

                  questionNumber++
                  const result = results[item.id] ?? ""
                  const isU = result === "U"

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "px-4 py-3 transition-colors",
                        isU && "bg-red-50/50 dark:bg-red-950/20"
                      )}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                        {/* Question number + text */}
                        <div className="flex min-w-0 flex-1 gap-3">
                          <span className="text-muted-foreground shrink-0 font-mono text-xs pt-0.5 w-6 text-right">
                            {questionNumber}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-relaxed">{item.label}</p>
                            {item.reference && (
                              <p className="text-muted-foreground font-mono text-xs mt-0.5">
                                Ref: {item.reference}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* S / U / N/A buttons */}
                        <div className="flex shrink-0 gap-1.5">
                          {(["S", "U", "NA"] as ResultType[]).map((r) => {
                            const cfg = resultConfig[r]
                            const active = result === r
                            return (
                              <button
                                key={r}
                                type="button"
                                disabled={session.status === "Completed" || savingItem === item.id}
                                onClick={() => void setResult(item.id, active ? "" : r)}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold transition-all",
                                  active ? cfg.cls : "border-border text-muted-foreground hover:border-border/80 hover:bg-muted/50",
                                  (session.status === "Completed" || savingItem === item.id) && "opacity-60 cursor-not-allowed"
                                )}
                                aria-label={cfg.label}
                                aria-pressed={active}
                              >
                                {cfg.icon}
                                {r}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Unsatisfactory notice + notes */}
                      {isU && (
                        <div className="mt-2 ml-9 rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 p-2">
                          <div className="flex items-start gap-1.5 text-red-700 dark:text-red-400 text-xs font-medium mb-1.5">
                            <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                            Bu madde bulgu olarak kaydedilecek
                          </div>
                          <Textarea
                            value={notes[item.id] ?? ""}
                            onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            onBlur={() => void saveNotes(item.id)}
                            placeholder="Bulguya not ekle (isteğe bağlı)…"
                            className="min-h-[60px] text-xs border-red-200"
                            disabled={session.status === "Completed"}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Complete confirmation dialog */}
      <Dialog open={confirmComplete} onOpenChange={setConfirmComplete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Denetimi tamamla?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Denetim tamamlandıktan sonra değişiklik yapılamaz.
            </p>
            {unsatisfactoryCount > 0 && (
              <p className="text-red-700 dark:text-red-400 font-medium">
                <AlertTriangle className="inline mr-1.5 size-4" />
                {unsatisfactoryCount} adet &ldquo;Unsatisfactory&rdquo; madde bulgu olarak Findings Follow Up&apos;a eklenecek.
              </p>
            )}
            {answeredCount < questionItems.length && (
              <p className="text-amber-700 dark:text-amber-400">
                Uyarı: {questionItems.length - answeredCount} madde henüz yanıtlanmadı.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmComplete(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={completing}
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={completeSession}
            >
              {completing ? "Tamamlanıyor…" : "Tamamla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
