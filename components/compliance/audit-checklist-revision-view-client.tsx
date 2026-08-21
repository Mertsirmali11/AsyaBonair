"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileDown,
  HelpCircle,
  Pencil,
  Plus,
  Printer,
  Trash2,
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
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import {
  buildChecklistExportLines,
  effectiveSectionAt,
  showSectionHeader,
  type ChecklistExportRow,
} from "@/lib/audit-checklist-export-lines"
import {
  downloadChecklistDocx,
  downloadChecklistPdf,
  type ChecklistExportMeta,
} from "@/lib/audit-checklist-export-download"
import { cn } from "@/lib/utils"

type RevisionItem = {
  id: number
  label: string
  sortOrder: number
  isRequired: boolean
  reference: string
  section: string
}

type RevisionPayload = {
  checklist: {
    id: number
    title: string
    checklistNumber: string
    latestRevisionNumber: number
    isActive: boolean
  }
  revision: {
    id: number | null
    revisionNumber: number
    revisionDate: string | null
    title: string
    description: string | null
    items: RevisionItem[]
    synthetic: boolean
    missingSnapshot?: boolean
  }
}

type DraftRow = { section: string; reference: string; label: string }

function itemsToDraft(items: RevisionItem[]): DraftRow[] {
  if (items.length === 0) {
    return [{ section: "", reference: "", label: "" }]
  }
  return items.map((it) => ({
    section: it.section ?? "",
    reference: it.reference ?? "",
    label: it.label ?? "",
  }))
}

async function parseJson(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return null
  }
}

const HEADER_ROW = "bg-[#1a365d] text-white hover:bg-[#1a365d]"
const SECTION_ROW = "bg-[#2c5282] text-white hover:bg-[#2c5282]"

export function AuditChecklistRevisionViewClient({
  checklistId,
  revisionNumber,
}: {
  checklistId: number
  revisionNumber: number
}) {
  const [data, setData] = React.useState<RevisionPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState(false)
  const [draftRows, setDraftRows] = React.useState<DraftRow[]>([
    { section: "", reference: "", label: "" },
  ])
  const [saving, setSaving] = React.useState(false)
  const printRef = React.useRef<HTMLDivElement>(null)
  const rowLabelRefs = React.useRef<Array<HTMLTextAreaElement | null>>([])
  const pendingFocusIndexRef = React.useRef<number | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/audit-checklists/${checklistId}/revisions/${revisionNumber}`,
        { cache: "no-store" }
      )
      const raw = await parseJson(res)
      if (!res.ok || !raw || typeof raw !== "object") {
        toast.error("Revizyon bulunamadı.")
        setData(null)
        return
      }
      setData(raw as RevisionPayload)
    } catch {
      toast.error("Yüklenemedi.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [checklistId, revisionNumber])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    if (data?.revision?.items) {
      setDraftRows(itemsToDraft(data.revision.items))
    }
  }, [data])

  React.useEffect(() => {
    const idx = pendingFocusIndexRef.current
    if (idx === null) return
    pendingFocusIndexRef.current = null
    const el = rowLabelRefs.current[idx]
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.focus()
    }
  }, [draftRows])

  const rev = data?.revision
  const displayTitle = rev?.title ?? data?.checklist.title ?? "Checklist"
  const dateStr = rev?.revisionDate && rev.revisionDate !== "—" ? rev.revisionDate : "—"
  const canEdit =
    !!data &&
    !data.revision.missingSnapshot &&
    data.checklist.latestRevisionNumber === revisionNumber

  const startEdit = () => {
    if (!data?.revision) return
    setDraftRows(itemsToDraft(data.revision.items))
    setEditing(true)
  }

  const cancelEdit = () => {
    if (data?.revision) setDraftRows(itemsToDraft(data.revision.items))
    setEditing(false)
  }

  const addRow = () => {
    setDraftRows((prev) => [...prev, { section: "", reference: "", label: "" }])
  }

  const insertRowAfter = (index: number) => {
    const newIndex = index + 1
    setDraftRows((prev) => {
      const next = [...prev]
      next.splice(newIndex, 0, { section: "", reference: "", label: "" })
      return next
    })
    pendingFocusIndexRef.current = newIndex
  }

  const updateRow = (index: number, patch: Partial<DraftRow>) => {
    setDraftRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const removeRow = (index: number) => {
    setDraftRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const moveRow = (index: number, dir: -1 | 1) => {
    setDraftRows((prev) => {
      const j = index + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }

  const persistDraft = async () => {
    if (!data?.checklist || !data.revision) return
    const title = data.revision.title.trim() || data.checklist.title.trim()
    if (!title) {
      toast.error("Checklist başlığı gerekli.")
      return
    }
    const items = draftRows
      .map((row, idx) => ({
        label: row.label.trim(),
        sortOrder: idx,
        reference: row.reference.trim() || undefined,
        section: row.section.trim() || undefined,
      }))
      .filter((r) => r.label.length > 0)

    setSaving(true)
    try {
      const res = await fetch(`/api/audit-checklists/${checklistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: data.revision.description?.trim() || undefined,
          isActive: data.checklist.isActive,
          items,
          bumpRevision: false,
        }),
      })
      const raw = await parseJson(res)
      if (!res.ok) {
        const err =
          raw && typeof raw === "object" && "error" in raw && typeof raw.error === "string"
            ? raw.error
            : "Kaydedilemedi."
        toast.error(err)
        return
      }
      toast.success("Kaydedildi. Revizyon numarası aynı kaldı; ara verebilirsiniz.")
      await load()
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const getExportRows = React.useCallback((): ChecklistExportRow[] => {
    if (!data?.revision) return []
    if (editing) {
      return draftRows.map((r) => ({
        section: r.section,
        reference: r.reference,
        label: r.label,
      }))
    }
    return data.revision.items.map((it) => ({
      section: it.section ?? "",
      reference: it.reference ?? "",
      label: it.label ?? "",
    }))
  }, [data, editing, draftRows])

  const buildExportMeta = React.useCallback((): ChecklistExportMeta | null => {
    if (!data?.revision) return null
    const title = data.revision.title.trim() || data.checklist.title
    const revDate =
      data.revision.revisionDate && data.revision.revisionDate !== "—"
        ? data.revision.revisionDate
        : "—"
    const lines = buildChecklistExportLines(getExportRows())
    return {
      title,
      checklistNumber: data.checklist.checklistNumber,
      revisionNumber,
      revisionDate: revDate,
      description: data.revision.description,
      lines,
    }
  }, [data, revisionNumber, getExportRows])

  const handleExportPdf = React.useCallback(() => {
    const m = buildExportMeta()
    if (!m) return
    try {
      downloadChecklistPdf(m)
      toast.success("PDF indirildi.")
    } catch {
      toast.error("PDF oluşturulamadı.")
    }
  }, [buildExportMeta])

  const handleExportDocx = React.useCallback(async () => {
    const m = buildExportMeta()
    if (!m) return
    try {
      await downloadChecklistDocx(m)
      toast.success("Word dosyası indirildi.")
    } catch {
      toast.error("Word dosyası oluşturulamadı.")
    }
  }, [buildExportMeta])

  return (
    <TooltipProvider>
      <SetWorkspacePageTitle title={`${displayTitle} — Rev. ${revisionNumber}`} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6 print:p-4">
        <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Breadcrumb className="text-xs sm:text-sm">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/dashboard">Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/compliance/checklists">Checklists</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link
                      href={`/compliance/checklists/${checklistId}/revisions`}
                      className="max-w-[140px] truncate"
                    >
                      Revizyonlar
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>#{revisionNumber}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                title="Revizyon listesi"
                asChild
              >
                <Link href={`/compliance/checklists/${checklistId}/revisions`}>
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
              <h1 className="text-2xl font-semibold tracking-tight">
                {loading ? "Yükleniyor…" : displayTitle}
              </h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md"
                    aria-label="Bilgi"
                  >
                    <HelpCircle className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs" side="bottom">
                  {rev?.missingSnapshot
                    ? "Bu numara için veritabanında anlık görüntü yok; salt okunur."
                    : canEdit
                      ? "Kaydet: güncel revizyona yazılır, numara değişmez (ara verirken kullanın). Yeni revizyon numarası için Revizyonlar → Yeni revizyon."
                      : "Bu revizyon arşiv kaydıdır; salt okunur. Düzenlemek için en son revizyona gidin veya «Güncel içerik» ile canlı şablona dönün."}
                </TooltipContent>
              </Tooltip>
            </div>
            {!loading && rev ? (
              <p className="text-muted-foreground font-mono text-sm">
                Revizyon yönet · #{rev.revisionNumber} | {dateStr}
                {rev.synthetic
                  ? " · Özet (tam arşiv bu checklist için sonraki kayıtlarla oluşur)"
                  : ""}
              </p>
            ) : null}
          </div>

          <div className="no-print flex flex-wrap gap-2">
            {canEdit && !editing ? (
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-orange-500 text-white hover:bg-orange-600"
                onClick={startEdit}
              >
                <Pencil className="size-4" />
                Düzenle
              </Button>
            ) : null}
            {canEdit && editing ? (
              <>
                <Button type="button" variant="outline" size="sm" disabled={saving} onClick={cancelEdit}>
                  İptal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={saving}
                  onClick={() => void persistDraft()}
                >
                  {saving ? "Kaydediliyor…" : "Kaydet"}
                </Button>
              </>
            ) : null}
            <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={handlePrint}>
              <Printer className="size-4" />
              Yazdır
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={!data?.revision}
                >
                  <FileDown className="size-4" />
                  Dışa aktar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleExportPdf}>PDF indir</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleExportDocx()}>
                  Word (.docx) indir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={`/compliance/checklists/${checklistId}`}>Güncel içerik</Link>
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Yükleniyor…</p>
        ) : !data?.revision ? (
          <p className="text-muted-foreground text-sm">Kayıt bulunamadı.</p>
        ) : (
          <>
            {data.revision.missingSnapshot ? (
              <div className="bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100 rounded-lg border border-amber-200 px-4 py-3 text-sm">
                Bu revizyon numarası listede yer alıyor ancak arşivde anlık görüntü kaydı yok; madde
                listesi boş gösterilir. Bundan sonraki «Yeni revizyon» işlemleri önceki sürümü
                kayda alır.
              </div>
            ) : null}
            {!editing && data.revision.description?.trim() ? (
              <div className="no-print bg-muted/40 rounded-lg border p-4">
                <p className="text-muted-foreground text-xs font-medium">Açıklama (revizyon)</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{data.revision.description.trim()}</p>
              </div>
            ) : null}

            <div ref={printRef}>
              <h2 className="no-print mb-2 text-lg font-semibold">
                Maddeler ({editing ? draftRows.filter((r) => r.label.trim()).length : data.revision.items.length})
              </h2>
              <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm print:border-slate-300 print:shadow-none">
                <ScrollArea className={cn(editing ? "h-[min(70vh,640px)]" : "h-[min(60vh,560px)]")}>
                  <Table className="min-w-[640px]">
                    <TableHeader>
                      <TableRow className={cn(HEADER_ROW, "border-0")}>
                        <TableHead className="w-12 text-white">#</TableHead>
                        <TableHead className="w-[min(28%,200px)] text-white">Referanslar</TableHead>
                        <TableHead className="text-white">Maddeler</TableHead>
                        {editing ? (
                          <TableHead className="no-print w-28 text-right text-white">İşlem</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editing ? (
                        <>
                          {draftRows.map((row, idx) => (
                            <TableRow
                              key={idx}
                              className={idx % 2 === 0 ? "bg-sky-50/40" : "bg-white"}
                            >
                              <TableCell className="align-top font-mono text-sm text-muted-foreground">
                                {idx + 1}
                              </TableCell>
                              <TableCell className="align-top">
                                <Input
                                  value={row.reference}
                                  onChange={(e) => updateRow(idx, { reference: e.target.value })}
                                  placeholder="Örn. SHT-17.3 Md.5"
                                  className="text-sm"
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <div className="flex flex-col gap-2">
                                  <Input
                                    value={row.section}
                                    onChange={(e) => updateRow(idx, { section: e.target.value })}
                                    placeholder="Bölüm başlığı (isteğe bağlı)"
                                    className="text-sm font-medium"
                                  />
                                  <Textarea
                                    ref={(el) => {
                                      rowLabelRefs.current[idx] = el
                                    }}
                                    value={row.label}
                                    onChange={(e) => updateRow(idx, { label: e.target.value })}
                                    placeholder="Denetim maddesi metni…"
                                    className="min-h-[72px] text-sm"
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="no-print align-top">
                                <div className="flex flex-col gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-emerald-600 hover:text-emerald-700"
                                    title="Altına satır ekle"
                                    onClick={() => insertRowAfter(idx)}
                                  >
                                    <Plus className="size-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                    title="Yukarı"
                                    onClick={() => moveRow(idx, -1)}
                                  >
                                    <ChevronUp className="size-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                    title="Aşağı"
                                    onClick={() => moveRow(idx, 1)}
                                  >
                                    <ChevronDown className="size-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-destructive"
                                    title="Satırı sil"
                                    onClick={() => removeRow(idx)}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="no-print bg-muted/30">
                            <TableCell colSpan={editing ? 4 : 3}>
                              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                                Satır ekle
                              </Button>
                            </TableCell>
                          </TableRow>
                        </>
                      ) : data.revision.items.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-muted-foreground h-28 text-center text-sm"
                          >
                            {canEdit
                              ? "Bu revizyonda madde yok. «Düzenle» ile satır ekleyin."
                              : "Bu revizyonda madde yok."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        (() => {
                          let ordinal = 0
                          return data.revision.items.flatMap((it, idx) => {
                            const showSec = showSectionHeader(data.revision.items, idx)
                            const out: React.ReactNode[] = []
                            if (showSec) {
                              out.push(
                                <TableRow key={`sec-${it.id}-${idx}`} className={cn(SECTION_ROW, "border-0")}>
                                  <TableCell
                                    colSpan={3}
                                    className="font-semibold tracking-wide text-white uppercase"
                                  >
                                    {effectiveSectionAt(data.revision.items, idx)}
                                  </TableCell>
                                </TableRow>
                              )
                            }
                            ordinal += 1
                            out.push(
                              <TableRow
                                key={it.id}
                                className={cn(idx % 2 === 0 ? "bg-sky-50/50" : "bg-white")}
                              >
                                <TableCell className="align-top font-mono text-sm text-muted-foreground">
                                  {ordinal}
                                </TableCell>
                                <TableCell className="align-top text-sm text-slate-700">
                                  {(it.reference ?? "").trim() || "—"}
                                </TableCell>
                                <TableCell className="max-h-[min(40vh,320px)] overflow-y-auto align-top text-sm text-slate-800">
                                  <p className="whitespace-pre-wrap">{it.label}</p>
                                  {it.label.length > 240 ? (
                                    <p className="text-primary mt-2 text-xs font-medium">
                                      Uzun metin — yazdırmak için «Yazdır» kullanın.
                                    </p>
                                  ) : null}
                                </TableCell>
                              </TableRow>
                            )
                            return out
                          })
                        })()
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </TooltipProvider>
  )
}
