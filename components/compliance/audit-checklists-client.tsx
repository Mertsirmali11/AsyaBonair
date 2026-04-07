"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Filter,
  HelpCircle,
  MoreVertical,
} from "lucide-react"
import { IconPlus } from "@tabler/icons-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
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
import { defaultChecklistNumber, revisionCell } from "@/lib/audit-checklist-helpers"
import { dbDateToDdMmYyyy, todayLocalDdMmYyyy } from "@/lib/correspondence-date"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { cn } from "@/lib/utils"

export type AuditChecklistListRow = {
  id: number
  title: string
  checklistNumber: string | null
  checklistType: string
  initialRevisionNumber: number
  initialRevisionDate: string | null
  latestRevisionNumber: number
  latestRevisionDate: string | null
  description: string | null
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  _count: { items: number; assignments: number }
}

type ChecklistItemRow = { label: string; sortOrder: number }

type ChecklistDetail = AuditChecklistListRow & {
  items: { id: number; label: string; sortOrder: number; isRequired: boolean }[]
}

/** API / veritabanı için sabit tip (arayüzde gösterilmez) */
const DEFAULT_CHECKLIST_TYPE = "Classic (Satisfactory/Unsatisfactory)"

async function parseJson(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return null
  }
}

function errMsg(data: unknown, fallback: string): string {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
  ) {
    return (data as { error: string }).error.trim()
  }
  return fallback
}

export function AuditChecklistsClient() {
  const router = useRouter()
  const uid = React.useId()
  const [rows, setRows] = React.useState<AuditChecklistListRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filterText, setFilterText] = React.useState("")

  const [formOpen, setFormOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [checklistNumber, setChecklistNumber] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [initialRev, setInitialRev] = React.useState("0")
  const [initialRevDate, setInitialRevDate] = React.useState(todayLocalDdMmYyyy())
  const [description, setDescription] = React.useState("")
  const [isActive, setIsActive] = React.useState(true)
  const [itemRows, setItemRows] = React.useState<ChecklistItemRow[]>([{ label: "", sortOrder: 0 }])
  const [saving, setSaving] = React.useState(false)

  const [deleteTarget, setDeleteTarget] = React.useState<AuditChecklistListRow | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/audit-checklists", { cache: "no-store" })
      const data = await parseJson(res)
      if (!res.ok) {
        toast.error(errMsg(data, "Liste yüklenemedi."))
        setRows([])
        return
      }
      setRows(Array.isArray(data) ? (data as AuditChecklistListRow[]) : [])
    } catch {
      toast.error("Liste yüklenemedi.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const filtered = React.useMemo(() => {
    const q = filterText.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const num = r.checklistNumber ?? defaultChecklistNumber(r.id)
      return [num, r.title, String(r.initialRevisionNumber), String(r.latestRevisionNumber)]
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
  }, [rows, filterText])

  const openCreate = () => {
    setEditingId(null)
    setChecklistNumber("")
    setTitle("")
    setInitialRev("0")
    setInitialRevDate(todayLocalDdMmYyyy())
    setDescription("")
    setIsActive(true)
    setItemRows([{ label: "", sortOrder: 0 }])
    setFormOpen(true)
  }

  const openEdit = React.useCallback(async (r: AuditChecklistListRow) => {
    setEditingId(r.id)
    setChecklistNumber(r.checklistNumber ?? "")
    setTitle(r.title)
    setInitialRev(String(r.initialRevisionNumber))
    setInitialRevDate(
      r.initialRevisionDate ? dbDateToDdMmYyyy(r.initialRevisionDate) : todayLocalDdMmYyyy()
    )
    setDescription(r.description ?? "")
    setIsActive(r.isActive)
    setFormOpen(true)
    try {
      const res = await fetch(`/api/audit-checklists/${r.id}`, { cache: "no-store" })
      const data = await parseJson(res)
      if (!res.ok || !data || typeof data !== "object") {
        toast.error("Detay yüklenemedi.")
        setItemRows([{ label: "", sortOrder: 0 }])
        return
      }
      const d = data as ChecklistDetail
      const items = Array.isArray(d.items) ? d.items : []
      setItemRows(
        items.length > 0
          ? items.map((it, i) => ({ label: it.label, sortOrder: it.sortOrder ?? i }))
          : [{ label: "", sortOrder: 0 }]
      )
    } catch {
      setItemRows([{ label: "", sortOrder: 0 }])
    }
  }, [])

  const sessionEditOpened = React.useRef(false)
  React.useEffect(() => {
    if (loading || rows.length === 0 || sessionEditOpened.current) return
    const raw = sessionStorage.getItem("openChecklistEdit")
    if (!raw) return
    sessionStorage.removeItem("openChecklistEdit")
    const id = Number(raw)
    if (!Number.isInteger(id) || id < 1) return
    const row = rows.find((r) => r.id === id)
    if (row) {
      sessionEditOpened.current = true
      void openEdit(row)
    }
  }, [loading, rows, openEdit])

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) {
      toast.error("Checklist adı gerekli.")
      return
    }
    const items =
      editingId === null
        ? []
        : itemRows
            .map((row, idx) => ({
              label: row.label.trim(),
              sortOrder: row.sortOrder ?? idx,
            }))
            .filter((row) => row.label.length > 0)

    setSaving(true)
    try {
      if (editingId === null) {
        const res = await fetch("/api/audit-checklists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: t,
            checklistNumber: checklistNumber.trim() || undefined,
            checklistType: DEFAULT_CHECKLIST_TYPE,
            initialRevisionNumber: Number(initialRev) || 0,
            initialRevisionDate: initialRevDate.trim(),
            items,
          }),
        })
        const data = await parseJson(res)
        if (!res.ok) {
          toast.error(errMsg(data, "Oluşturulamadı."))
          return
        }
        toast.success("Checklist oluşturuldu.")
        setFormOpen(false)
        await load()
        return
      }

      const res = await fetch(`/api/audit-checklists/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          checklistNumber: checklistNumber.trim() || undefined,
          checklistType: DEFAULT_CHECKLIST_TYPE,
          description: description.trim() || undefined,
          isActive,
          items,
          bumpRevision: true,
        }),
      })
      const data = await parseJson(res)
      if (!res.ok) {
        toast.error(errMsg(data, "Kaydedilemedi."))
        return
      }
      toast.success("Kaydedildi.")
      setFormOpen(false)
      await load()
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/audit-checklists/${deleteTarget.id}`, { method: "DELETE" })
      const data = await parseJson(res)
      if (!res.ok) {
        toast.error(errMsg(data, "Silinemedi."))
        return
      }
      toast.success("Silindi.")
      setDeleteTarget(null)
      await load()
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setDeleting(false)
    }
  }

  const addItemRow = () => {
    setItemRows((prev) => [...prev, { label: "", sortOrder: prev.length }])
  }

  const updateItemRow = (index: number, label: string) => {
    setItemRows((prev) => prev.map((r, i) => (i === index ? { ...r, label } : r)))
  }

  const removeItemRow = (index: number) => {
    setItemRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  return (
    <TooltipProvider>
      <SetWorkspacePageTitle title="Checklists" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
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
                      <Link href="/compliance">Compliance Monitoring</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Checklists</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                title="Geri"
                onClick={() => router.push("/compliance")}
              >
                <ArrowLeft className="size-4" />
              </Button>
              <h1 className="text-2xl font-semibold tracking-tight">Checklists</h1>
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
                  Checklist şablonları burada tanımlanır. Audit Plan üzerinden denetimlere atanır.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
            onClick={openCreate}
          >
            <IconPlus className="mr-1.5 size-4" />
            Add Checklist
          </Button>
        </div>

        <div className="relative max-w-md">
          <Input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Tabloda ara…"
            className="h-9 pl-3"
          />
        </div>

        <div className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border shadow-sm">
          <ScrollArea className="h-[min(70vh,720px)]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-12 px-2" />
                  <TableHead className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      Checklist Number
                      <Filter className="text-muted-foreground size-3.5 opacity-60" />
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      Checklist Name
                      <Filter className="text-muted-foreground size-3.5 opacity-60" />
                    </span>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      Initial Revision
                      <Filter className="text-muted-foreground size-3.5 opacity-60" />
                    </span>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      Latest Revision
                      <Filter className="text-muted-foreground size-3.5 opacity-60" />
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground h-32 text-center">
                      Yükleniyor…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground h-32 text-center">
                      {rows.length === 0
                        ? "Henüz checklist yok. «Add Checklist» ile ekleyin."
                        : "Arama ile eşleşen kayıt yok."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const num = r.checklistNumber ?? defaultChecklistNumber(r.id)
                    return (
                      <TableRow key={r.id} className="group">
                        <TableCell className="w-12 px-1 align-middle">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground"
                                aria-label="İşlemler"
                              >
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem asChild>
                                <Link href={`/compliance/checklists/${r.id}`}>İçeriği aç</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void openEdit(r)}>
                                Yönet
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/compliance/checklists/${r.id}/revisions`}>
                                  Revizyon
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(r)}
                              >
                                Sil
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{num}</TableCell>
                        <TableCell className="max-w-[min(280px,40vw)] font-medium">
                          <Link
                            href={`/compliance/checklists/${r.id}`}
                            className="hover:text-primary underline-offset-2 hover:underline"
                          >
                            {r.title}
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-sm">
                          {revisionCell(r.initialRevisionNumber, r.initialRevisionDate)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-sm">
                          {revisionCell(r.latestRevisionNumber, r.latestRevisionDate)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          className={cn(
            "flex w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0",
            editingId === null
              ? "max-h-[min(90vh,560px)] sm:max-w-md"
              : "max-h-[min(92vh,720px)] sm:max-w-lg"
          )}
        >
          <DialogHeader className="shrink-0 px-6 pt-6 pr-14 text-left">
            <DialogTitle>
              {editingId !== null ? "Checklist düzenle" : "Create New Checklist"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={submitForm}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-2 pt-2">
              {editingId === null ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor={`cl-num-${uid}`}>Checklist Number (Identifier)</Label>
                    <Input
                      id={`cl-num-${uid}`}
                      value={checklistNumber}
                      onChange={(e) => setChecklistNumber(e.target.value)}
                      placeholder="Please enter an identifier…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`cl-title-${uid}`}>Checklist Name</Label>
                    <Input
                      id={`cl-title-${uid}`}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Please enter a name…"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`cl-ir-${uid}`}>Initial Revision Number</Label>
                    <Input
                      id={`cl-ir-${uid}`}
                      value={initialRev}
                      onChange={(e) => setInitialRev(e.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Revision Date</Label>
                    <DatePicker
                      value={initialRevDate}
                      onChange={setInitialRevDate}
                      placeholder="dd.mm.yyyy"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor={`cl-num-${uid}`}>Checklist Number (isteğe bağlı)</Label>
                    <Input
                      id={`cl-num-${uid}`}
                      value={checklistNumber}
                      onChange={(e) => setChecklistNumber(e.target.value)}
                      placeholder="Boş bırakılırsa otomatik (örn. BON-CMM-CL-010)"
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-muted-foreground text-xs">
                      Numara oluşturulduktan sonra değiştirilemez.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`cl-title-${uid}`}>Checklist Name</Label>
                    <Input
                      id={`cl-title-${uid}`}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Security Inspection Checklist"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`cl-desc-${uid}`}>Açıklama</Label>
                    <Textarea
                      id={`cl-desc-${uid}`}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="min-h-[72px]"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor={`cl-act-${uid}`}>Aktif</Label>
                      <p className="text-muted-foreground text-xs">
                        Pasif şablonlar yeni atamalarda listelenmez.
                      </p>
                    </div>
                    <Switch id={`cl-act-${uid}`} checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Maddeler</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addItemRow}>
                        Satır ekle
                      </Button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {itemRows.map((row, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            value={row.label}
                            onChange={(e) => updateItemRow(idx, e.target.value)}
                            placeholder={`Madde ${idx + 1}`}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-destructive"
                            title="Kaldır"
                            onClick={() => removeItemRow(idx)}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter className="mt-auto shrink-0 gap-2 border-t border-border px-6 py-4 sm:justify-end">
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving
                  ? editingId
                    ? "Kaydediliyor…"
                    : "Creating…"
                  : editingId
                    ? "Kaydet"
                    : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Checklist silinsin mi?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {deleteTarget
              ? `“${deleteTarget.title}” silinecek. Denetim atamaları da kalkar.`
              : ""}
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? "Siliniyor…" : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
