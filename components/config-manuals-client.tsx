"use client"

import * as React from "react"
import {
  IconArchive,
  IconPencil,
  IconSearch,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react"
import { formatDateTimeIstanbul } from "@/lib/date-format"
import {
  DOCUMENT_ACCEPT_HTML,
  lowerExtension,
} from "@/lib/allowed-document-uploads"
import { isValidCustomManualDepartment } from "@/lib/organization-departments"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ManualsHeaderHelp } from "@/components/manuals-header-help"
import { SetWorkspacePageTitleAccessory } from "@/components/workspace-page-title"

/** Düzenle / revizyon akışında yalnızca PDF yüklenir (ilk yüklemede Word vb. yükleme penceresi ile). */
const REVISION_PDF_ACCEPT = "application/pdf,.pdf"

type ManualRow = {
  id: number
  title: string
  slug: string
  createdAt: string
  updatedAt: string
  department: string | null
  revision: number
  isCurrent: boolean
  createdBy: number | null
  documentPreview?: "pdf" | "none" | "unsupported"
  creator: {
    isim: string | null
    soyisim: string | null
    email: string
  } | null
}

function formatUploaderLabel(m: ManualRow): string {
  const c = m.creator
  if (!c) return "—"
  const name = `${c.isim ?? ""} ${c.soyisim ?? ""}`.trim()
  if (name) return `${name} (${c.email})`
  return c.email
}

function matchesManualSearch(m: ManualRow, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const up = formatUploaderLabel(m).toLowerCase()
  return (
    m.title.toLowerCase().includes(s) ||
    m.slug.toLowerCase().includes(s) ||
    (m.department ?? "").toLowerCase().includes(s) ||
    `rev.${m.revision}`.includes(s) ||
    String(m.revision).includes(s) ||
    up.includes(s)
  )
}

const manualsHeaderHelp = <ManualsHeaderHelp />

export function ConfigManualsClient() {
  const [items, setItems] = React.useState<ManualRow[]>([])
  const [historicItems, setHistoricItems] = React.useState<ManualRow[]>([])
  const [viewerIsAdminDepartment, setViewerIsAdminDepartment] =
    React.useState(false)
  const [canManageManuals, setCanManageManuals] = React.useState(false)
  const [departmentOptions, setDepartmentOptions] = React.useState<string[]>(
    []
  )
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")

  const [addOpen, setAddOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [department, setDepartment] = React.useState<string>("")
  const [departmentTab, setDepartmentTab] = React.useState<"list" | "custom">("list")
  const [customDepartment, setCustomDepartment] = React.useState("")
  const [uploadMode, setUploadMode] = React.useState<"new" | "revision">("new")
  const [supersedesId, setSupersedesId] = React.useState<string>("")
  const [revisionInput, setRevisionInput] = React.useState("0")
  const [file, setFile] = React.useState<File | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<number | null>(null)
  const [archivingId, setArchivingId] = React.useState<number | null>(null)
  const [banner, setBanner] = React.useState<{
    type: "ok" | "err"
    text: string
  } | null>(null)

  const [editOpen, setEditOpen] = React.useState(false)
  const [editRow, setEditRow] = React.useState<ManualRow | null>(null)
  const [editTab, setEditTab] = React.useState<"pdf" | "revizyon">("pdf")
  const [editSaving, setEditSaving] = React.useState(false)
  const [editRevTitle, setEditRevTitle] = React.useState("")
  const [editRevDeptTab, setEditRevDeptTab] = React.useState<"list" | "custom">(
    "list"
  )
  const [editRevDepartment, setEditRevDepartment] = React.useState("")
  const [editRevCustomDepartment, setEditRevCustomDepartment] = React.useState("")
  const [editRevRevision, setEditRevRevision] = React.useState("")
  const [editRevFile, setEditRevFile] = React.useState<File | null>(null)

  React.useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner(null), 5000)
    return () => window.clearTimeout(t)
  }, [banner])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/manuals", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        manuals?: ManualRow[]
        historicManuals?: ManualRow[]
        viewerIsAdminDepartment?: boolean
        canManageManuals?: boolean
        departmentOptions?: string[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "Could not load list")
      const list = Array.isArray(data.manuals) ? data.manuals : []
      setItems(
        list.map((m) => ({
          ...m,
          revision: m.revision ?? 0,
          isCurrent: m.isCurrent ?? true,
          createdBy: m.createdBy ?? null,
          creator: m.creator ?? null,
          documentPreview: m.documentPreview ?? "none",
        }))
      )
      setHistoricItems(
        Array.isArray(data.historicManuals)
          ? data.historicManuals.map((m) => ({
              ...m,
              revision: m.revision ?? 0,
              isCurrent: m.isCurrent ?? false,
              createdBy: m.createdBy ?? null,
              creator: m.creator ?? null,
              documentPreview: m.documentPreview ?? "none",
            }))
          : []
      )
      setViewerIsAdminDepartment(!!data.viewerIsAdminDepartment)
      setCanManageManuals(!!data.canManageManuals)
      setDepartmentOptions(
        Array.isArray(data.departmentOptions) ? data.departmentOptions : []
      )
    } catch (e) {
      console.error("[manuals] load:", e)
      setItems([])
      setHistoricItems([])
      setDepartmentOptions([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const resetAddForm = () => {
    setTitle("")
    setDepartment("")
    setDepartmentTab("list")
    setCustomDepartment("")
    setUploadMode("new")
    setSupersedesId("")
    setRevisionInput("0")
    setFile(null)
  }

  const revisionNumberValid = React.useMemo(() => {
    const n = Number.parseInt(revisionInput.trim(), 10)
    return Number.isFinite(n) && n >= 0 && n <= 999999
  }, [revisionInput])

  const editRevRevisionValid = React.useMemo(() => {
    const n = Number.parseInt(editRevRevision.trim(), 10)
    return Number.isFinite(n) && n >= 0 && n <= 999999
  }, [editRevRevision])

  const editRevDeptValid = React.useMemo(() => {
    if (editRevDeptTab === "list") {
      return Boolean(editRevDepartment.trim()) && departmentOptions.length > 0
    }
    return isValidCustomManualDepartment(editRevCustomDepartment)
  }, [
    editRevDeptTab,
    editRevDepartment,
    editRevCustomDepartment,
    departmentOptions.length,
  ])

  const resetEditDialog = React.useCallback(() => {
    setEditRow(null)
    setEditTab("pdf")
    setEditSaving(false)
    setEditRevTitle("")
    setEditRevDeptTab("list")
    setEditRevDepartment("")
    setEditRevCustomDepartment("")
    setEditRevRevision("")
    setEditRevFile(null)
  }, [])

  const editRevPdfValid = React.useMemo(() => {
    if (!editRevFile || editRevFile.size === 0) return false
    return lowerExtension(editRevFile.name) === ".pdf"
  }, [editRevFile])

  const openEditManual = React.useCallback(
    (m: ManualRow) => {
      setEditRow(m)
      setEditOpen(true)
      setEditTab("pdf")
      setEditRevFile(null)
      setEditRevTitle(m.title)
      const dep = (m.department ?? "").trim()
      if (dep && departmentOptions.includes(dep)) {
        setEditRevDeptTab("list")
        setEditRevDepartment(dep)
        setEditRevCustomDepartment("")
      } else {
        setEditRevDeptTab("custom")
        setEditRevCustomDepartment(dep)
        setEditRevDepartment("")
      }
      setEditRevRevision(String(Math.max(0, m.revision ?? 0) + 1))
    },
    [departmentOptions]
  )

  const submitPdfRevision = async () => {
    if (!editRow) return
    const t = editRevTitle.trim()
    const deptValue =
      editRevDeptTab === "list"
        ? editRevDepartment.trim()
        : editRevCustomDepartment.trim()
    if (!editRevFile || !editRevPdfValid) {
      setBanner({
        type: "err",
        text: "Yeni revizyon için geçerli bir PDF dosyası seçin.",
      })
      return
    }
    if (!t || !deptValue || !editRevDeptValid) {
      setBanner({
        type: "err",
        text: "Başlık ve sahip departman gerekli.",
      })
      return
    }
    if (!editRevRevisionValid) {
      setBanner({
        type: "err",
        text: "Revizyon numarası 0–999999 arasında tam sayı olmalıdır.",
      })
      return
    }
    setEditSaving(true)
    try {
      const fd = new FormData()
      fd.append("title", t)
      fd.append("department", deptValue)
      fd.append("departmentMode", editRevDeptTab)
      fd.append("revision", editRevRevision.trim())
      fd.append("supersedesId", String(editRow.id))
      fd.append("file", editRevFile)
      const res = await fetch("/api/manuals", { method: "POST", body: fd })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Kayıt başarısız")
      setBanner({
        type: "ok",
        text:
          "Yeni revizyon kaydedildi. PDF depolandı; Bonair AI güncellenmiş dosyadan çıkarılan metni kullanır.",
      })
      setEditOpen(false)
      resetEditDialog()
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Kayıt başarısız",
      })
    } finally {
      setEditSaving(false)
    }
  }

  const departmentChoiceValid = React.useMemo(() => {
    if (departmentTab === "list") {
      return Boolean(department.trim()) && departmentOptions.length > 0
    }
    const t = customDepartment.trim()
    return t.length >= 1 && t.length <= 100
  }, [departmentTab, department, customDepartment, departmentOptions.length])

  const submit = async () => {
    const t = title.trim()
    const deptValue =
      departmentTab === "list" ? department.trim() : customDepartment.trim()
    if (!t || !file || !deptValue || !departmentChoiceValid) {
      setBanner({
        type: "err",
        text: "Title, owning department, and a file (PDF, Word, Excel, or PowerPoint) are required.",
      })
      return
    }
    if (!revisionNumberValid) {
      setBanner({
        type: "err",
        text: "Enter a revision number between 0 and 999999 (whole number).",
      })
      return
    }
    if (uploadMode === "revision") {
      const sid = Number.parseInt(supersedesId, 10)
      if (!Number.isFinite(sid) || sid < 1) {
        setBanner({
          type: "err",
          text: "Pick the current manual this upload replaces.",
        })
        return
      }
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("title", t)
      fd.append("department", deptValue)
      fd.append("departmentMode", departmentTab)
      fd.append("revision", revisionInput.trim())
      fd.append("file", file)
      if (uploadMode === "revision") {
        fd.append("supersedesId", supersedesId)
      }
      const res = await fetch("/api/manuals", { method: "POST", body: fd })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Upload failed")
      setBanner({
        type: "ok",
        text:
          uploadMode === "revision"
            ? "New revision saved. Older revisions appear only to users in the Admin department."
            : "Manual saved. It can be selected in Bonair AI chat.",
      })
      resetAddForm()
      setAddOpen(false)
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Upload failed",
      })
    } finally {
      setUploading(false)
    }
  }

  const archiveCurrent = async (id: number) => {
    if (
      !confirm(
        "Move this current revision to Previous revisions? If this series has only one row, it will disappear from the active list and Bonair AI until you upload a new revision. If there are older revisions in the same series, the highest of those becomes current again."
      )
    ) {
      return
    }
    setArchivingId(id)
    try {
      const res = await fetch(`/api/manuals/${id}/archive-current`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Could not archive")
      setBanner({
        type: "ok",
        text: viewerIsAdminDepartment
          ? "Revision archived — check Previous revisions below."
          : "Revision archived. It no longer appears in the active list; only Admin department users see it under Previous revisions.",
      })
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not archive",
      })
    } finally {
      setArchivingId(null)
    }
  }

  const remove = async (id: number) => {
    if (!confirm("Delete this manual?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/manuals/${id}`, { method: "DELETE" })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Could not delete")
      setBanner({ type: "ok", text: "Manual deleted." })
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not delete",
      })
    } finally {
      setDeletingId(null)
    }
  }

  const filteredCurrent = React.useMemo(
    () => items.filter((m) => matchesManualSearch(m, search)),
    [items, search]
  )
  const filteredHistoric = React.useMemo(
    () => historicItems.filter((m) => matchesManualSearch(m, search)),
    [historicItems, search]
  )

  const revisionParentOptions = items.filter((m) => m.isCurrent !== false)

  return (
    <>
      <SetWorkspacePageTitleAccessory>{manualsHeaderHelp}</SetWorkspacePageTitleAccessory>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {banner && (
        <div
          role="status"
          className={
            banner.type === "ok"
              ? "rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground"
              : "rounded-lg border border-destructive/40 bg-background px-4 py-3 text-sm text-destructive"
          }
        >
          {banner.text}
        </div>
      )}

      {canManageManuals ? (
        <Card className="border-primary/25 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Doküman yükleme</CardTitle>
            <CardDescription className="text-muted-foreground">
              <strong className="text-foreground">Admin</strong>,{" "}
              <strong className="text-foreground">Quality</strong> veya{" "}
              <strong className="text-foreground">Human Resources</strong> departmanındaki
              hesaplar yeni manuel yükleyebilir veya mevcut seriye yeni revizyon ekleyebilir.
              Yeni revizyon kaydedildiğinde önceki güncel sürüm otomatik olarak arşive
              alınır (güncel listede yalnızca son sürüm kalır).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              size="lg"
              className="w-full gap-2 sm:w-auto"
              onClick={() => {
                resetAddForm()
                setAddOpen(true)
              }}
            >
              <IconUpload className="size-5" />
              Yeni doküman veya revizyon yükle
            </Button>
            <p className="text-muted-foreground text-sm sm:max-w-md sm:flex-1">
              İsterseniz listedeki bir satırda <strong className="text-foreground">Düzenle</strong>{" "}
              ile PDF’yi önizleyip bilgisayarınızda düzenledikten sonra{" "}
              <strong className="text-foreground">Yeni revizyon numarası ver</strong> adımına
              geçin.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="manual-search" className="text-muted-foreground">
          Manuel ara
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 gap-2">
            <Input
              id="manual-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Başlık, departman, yükleyen, slug, revizyon…"
              className="flex-1"
            />
            <Button type="button" variant="secondary" className="shrink-0 gap-1.5">
              <IconSearch className="size-4" />
              Ara
            </Button>
          </div>
        </div>
      </div>
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) resetAddForm()
        }}
      >
        <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Doküman yükle</DialogTitle>
            <DialogDescription>
              PDF veya Office dosyasından metin çıkarılır (Bonair AI). Revizyon numarasını
              siz verirsiniz. Sahip departman: standart liste veya özel etiket. Arşivdeki
              eski sürümleri yalnızca Admin departmanındaki kullanıcılar listede görür.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="space-y-2">
              <Label>Upload type</Label>
              <Select
                value={uploadMode}
                onValueChange={(v) => {
                  setUploadMode(v as "new" | "revision")
                  setSupersedesId("")
                }}
                disabled={uploading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New manual</SelectItem>
                  <SelectItem value="revision">New revision of existing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {uploadMode === "revision" ? (
              <div className="space-y-2">
                <Label htmlFor="manual-supersedes">Current manual to supersede</Label>
                <Select
                  value={supersedesId || undefined}
                  onValueChange={setSupersedesId}
                  disabled={uploading || revisionParentOptions.length === 0}
                >
                  <SelectTrigger id="manual-supersedes" className="w-full">
                    <SelectValue placeholder="Select current manual…" />
                  </SelectTrigger>
                  <SelectContent>
                    {revisionParentOptions.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.title} (Rev. {m.revision ?? 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {revisionParentOptions.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Upload a new manual first; then you can add revisions.
                  </p>
                ) : null}
                {uploadMode === "revision" && supersedesId ? (
                  <p className="text-muted-foreground text-xs">
                    Current row is Rev.{" "}
                    {revisionParentOptions.find((m) => String(m.id) === supersedesId)
                      ?.revision ?? "—"}
                    . Enter the new revision number below.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="modal-manual-title">Manual title</Label>
              <Input
                id="modal-manual-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Compliance Monitoring Manual"
                disabled={uploading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-manual-revision">Revision number</Label>
              <Input
                id="modal-manual-revision"
                type="number"
                min={1}
                max={999999}
                step={1}
                inputMode="numeric"
                value={revisionInput}
                onChange={(e) => setRevisionInput(e.target.value)}
                placeholder="e.g. 29"
                disabled={uploading}
              />
              <p className="text-muted-foreground text-xs">
                Same series cannot reuse a revision number. For a new manual, this is
                usually 1 unless you match your document numbering.
              </p>
            </div>
            <div className="space-y-3">
              <Label>Owning department</Label>
              <Tabs
                value={departmentTab}
                onValueChange={(v) => {
                  const next = v as "list" | "custom"
                  setDepartmentTab(next)
                  if (next === "list") setCustomDepartment("")
                  else setDepartment("")
                }}
              >
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="list" disabled={uploading}>
                    Standard list
                  </TabsTrigger>
                  <TabsTrigger value="custom" disabled={uploading}>
                    Custom label
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="list" className="mt-2 space-y-2">
                  <p className="text-muted-foreground text-xs">
                    Same options as User Management (fixed organization departments).
                  </p>
                  <Select
                    value={department || undefined}
                    onValueChange={setDepartment}
                    disabled={uploading || departmentOptions.length === 0}
                  >
                    <SelectTrigger id="modal-manual-department" className="w-full">
                      <SelectValue placeholder="Select department…" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentOptions.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TabsContent>
                <TabsContent value="custom" className="mt-2 space-y-2">
                  <p className="text-muted-foreground text-xs">
                    Use when the owning unit is not in the list (e.g. project name). Max
                    100 characters.
                  </p>
                  <Input
                    id="modal-manual-department-custom"
                    value={customDepartment}
                    onChange={(e) => setCustomDepartment(e.target.value)}
                    placeholder="e.g. SMS Working Group"
                    disabled={uploading}
                    maxLength={100}
                  />
                </TabsContent>
              </Tabs>
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-manual-file">File (PDF, Word, Excel, PowerPoint)</Label>
              <Input
                id="modal-manual-file"
                type="file"
                accept={DOCUMENT_ACCEPT_HTML}
                disabled={uploading}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => {
                setAddOpen(false)
                resetAddForm()
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                uploading ||
                !title.trim() ||
                !departmentChoiceValid ||
                !revisionNumberValid ||
                !file ||
                (uploadMode === "revision" &&
                  (!supersedesId || revisionParentOptions.length === 0))
              }
              className="gap-2"
              onClick={() => void submit()}
            >
              <IconUpload className="size-4" />
              {uploading ? "Uploading…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) resetEditDialog()
        }}
      >
        <DialogContent className="flex max-h-[min(92vh,720px)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4">
            <DialogTitle>Manueli düzenle ve revize et</DialogTitle>
            <DialogDescription>
              Önce <span className="font-medium text-foreground">PDF önizle</span> ile
              dokümana bakın; düzenlemeleri bilgisayarınızda tamamladıktan sonra{" "}
              <span className="font-medium text-foreground">Yeni revizyon numarası ver</span>{" "}
              sekmesine geçip numarayı girip güncellenmiş PDF’yi yükleyin. Kayıtta önceki
              güncel sürüm otomatik arşive alınır. Tarayıcı içinde PDF düzenlenmez.
            </DialogDescription>
          </DialogHeader>
          <Tabs
            value={editTab}
            onValueChange={(v) => setEditTab(v as "pdf" | "revizyon")}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="shrink-0 px-6 pt-2">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="pdf" disabled={editSaving}>
                  PDF önizle
                </TabsTrigger>
                <TabsTrigger value="revizyon" disabled={editSaving}>
                  Yeni revizyon numarası ver
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent
              value="pdf"
              className="mt-0 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 pb-4 pt-3 data-[state=inactive]:hidden"
            >
              {!editRow ? null : editRow.documentPreview === "pdf" ? (
                <>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    PDF aşağıda gömülüdür. Düzenlemek için indirip Acrobat veya benzeri
                    bir uygulamada açın; bitince{" "}
                    <strong className="text-foreground">Yeni revizyon numarası ver</strong>{" "}
                    sekmesine geçin.
                  </p>
                  <iframe
                    title="Manuel PDF önizleme"
                    src={`/api/manuals/${editRow.id}/file`}
                    className="min-h-[min(52vh,480px)] w-full flex-1 rounded-md border bg-muted/30"
                  />
                  <Button type="button" variant="outline" size="sm" className="shrink-0 self-start" asChild>
                    <a
                      href={`/api/manuals/${editRow.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Yeni sekmede aç / indir
                    </a>
                  </Button>
                </>
              ) : editRow.documentPreview === "unsupported" ? (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Bu sürüm PDF değil (ör. Word/Excel). Tarayıcıda gömülü önizleme yok;
                    dosyayı indirip düzenleyebilirsiniz.
                  </p>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a
                      href={`/api/manuals/${editRow.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Dosyayı indir
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    Bu kayıtta henüz saklı dosya yok (eski yükleme).{" "}
                    <strong className="text-foreground">Yeni revizyon numarası ver</strong>{" "}
                    sekmesinden güncellenmiş <strong className="text-foreground">PDF</strong>{" "}
                    yükleyin; kayıttan sonra önizleme burada görünür.
                  </p>
                </div>
              )}
            </TabsContent>
            <TabsContent
              value="revizyon"
              className="mt-0 max-h-[min(52vh,480px)] space-y-4 overflow-y-auto px-6 pb-4 pt-3 data-[state=inactive]:hidden"
            >
              <p className="text-muted-foreground text-xs leading-relaxed">
                <strong className="text-foreground">Revizyonu kaydet</strong> dediğinizde
                bu satırdaki güncel sürüm otomatik arşive gider; listede yalnızca yeni
                revizyon kalır. Yalnızca <strong className="text-foreground">PDF</strong>{" "}
                yükleyin. Seride aynı revizyon numarası varsa sunucu reddeder.
              </p>
              <div className="space-y-2">
                <Label htmlFor="edit-rev-title">Manuel başlığı</Label>
                <Input
                  id="edit-rev-title"
                  value={editRevTitle}
                  onChange={(e) => setEditRevTitle(e.target.value)}
                  disabled={editSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-rev-revision">Yeni revizyon numarası</Label>
                <Input
                  id="edit-rev-revision"
                  type="number"
                  min={0}
                  max={999999}
                  step={1}
                  inputMode="numeric"
                  value={editRevRevision}
                  onChange={(e) => setEditRevRevision(e.target.value)}
                  disabled={editSaving}
                />
              </div>
              <div className="space-y-3">
                <Label>Sahip departman</Label>
                <Tabs
                  value={editRevDeptTab}
                  onValueChange={(v) => {
                    const next = v as "list" | "custom"
                    setEditRevDeptTab(next)
                    if (next === "list") setEditRevCustomDepartment("")
                    else setEditRevDepartment("")
                  }}
                >
                  <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="list" disabled={editSaving}>
                      Standart liste
                    </TabsTrigger>
                    <TabsTrigger value="custom" disabled={editSaving}>
                      Özel etiket
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="list" className="mt-2 space-y-2">
                    <Select
                      value={editRevDepartment || undefined}
                      onValueChange={setEditRevDepartment}
                      disabled={editSaving || departmentOptions.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Departman seçin…" />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentOptions.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TabsContent>
                  <TabsContent value="custom" className="mt-2 space-y-2">
                    <Input
                      value={editRevCustomDepartment}
                      onChange={(e) => setEditRevCustomDepartment(e.target.value)}
                      placeholder="Örn. SMS Çalışma Grubu"
                      disabled={editSaving}
                      maxLength={100}
                    />
                  </TabsContent>
                </Tabs>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-rev-pdf">Güncellenmiş PDF</Label>
                <Input
                  id="edit-rev-pdf"
                  type="file"
                  accept={REVISION_PDF_ACCEPT}
                  disabled={editSaving}
                  onChange={(e) => setEditRevFile(e.target.files?.[0] ?? null)}
                />
                {editRevFile && !editRevPdfValid ? (
                  <p className="text-destructive text-xs">
                    Yalnızca .pdf uzantılı dosya seçin.
                  </p>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 sm:justify-between">
            {editTab === "pdf" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={editSaving}
                  onClick={() => {
                    setEditOpen(false)
                    resetEditDialog()
                  }}
                >
                  İptal
                </Button>
                <Button
                  type="button"
                  disabled={editSaving}
                  onClick={() => setEditTab("revizyon")}
                >
                  Yeni revizyon numarası ver →
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={editSaving}
                  onClick={() => setEditTab("pdf")}
                >
                  ← PDF önizlemeye dön
                </Button>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={editSaving}
                    onClick={() => {
                      setEditOpen(false)
                      resetEditDialog()
                    }}
                  >
                    İptal
                  </Button>
                  <Button
                    type="button"
                    className="gap-2"
                    disabled={
                      editSaving ||
                      !editRevPdfValid ||
                      !editRevTitle.trim() ||
                      !editRevDeptValid ||
                      !editRevRevisionValid
                    }
                    onClick={() => void submitPdfRevision()}
                  >
                    <IconUpload className="size-4" />
                    {editSaving ? "Kaydediliyor…" : "Revizyonu kaydet"}
                  </Button>
                </div>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Yüklü manueller</CardTitle>
          <CardDescription>
            Güncel sürümler listede; ayrıntılar için üst başlıktaki{" "}
            <span className="font-medium text-foreground">?</span> simgesine gelin.
            {viewerIsAdminDepartment
              ? " Arşiv: aşağıda (Admin)."
              : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredCurrent.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {items.length === 0
                ? "No manuals yet."
                : "No manuals match your search."}
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {filteredCurrent.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{m.title}</p>
                    <p className="text-muted-foreground text-xs">
                      Rev. {m.revision ?? 0}
                      {m.department ? ` · ${m.department}` : ""}
                      {" · "}
                      Uploaded by {formatUploaderLabel(m)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatDateTimeIstanbul(m.createdAt)} (uploaded) ·{" "}
                      {formatDateTimeIstanbul(m.updatedAt)} (updated) · {m.slug}
                    </p>
                  </div>
                  {canManageManuals ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        disabled={archivingId === m.id || deletingId === m.id}
                        onClick={() => openEditManual(m)}
                        title="Metni düzenle ve yeni revizyon ver"
                        aria-label="Düzenle: metni düzenle ve yeni revizyon ver"
                      >
                        <IconPencil className="size-4 shrink-0" />
                        <span className="hidden sm:inline">Düzenle</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:bg-muted hover:text-foreground"
                        disabled={archivingId === m.id || deletingId === m.id}
                        onClick={() => void archiveCurrent(m.id)}
                        aria-label="Move to previous revisions"
                        title="Move to previous revisions"
                      >
                        <IconArchive className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={deletingId === m.id || archivingId === m.id}
                        onClick={() => void remove(m.id)}
                        aria-label="Delete"
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {viewerIsAdminDepartment ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Previous revisions</CardTitle>
            <CardDescription>
              Admin department only: archived superseded files. Downloading full text
              via the API is also restricted the same way.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-12 w-full" />
            ) : filteredHistoric.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {historicItems.length === 0
                  ? "No superseded revisions."
                  : "No archived manuals match your search."}
              </p>
            ) : (
              <ul className="divide-y rounded-md border border-dashed">
                {filteredHistoric.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 bg-muted/30 p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-muted-foreground">{m.title}</p>
                      <p className="text-muted-foreground text-xs">
                        Rev. {m.revision ?? 0}
                        {m.department ? ` · ${m.department}` : ""}
                        {" · "}
                        Uploaded by {formatUploaderLabel(m)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatDateTimeIstanbul(m.createdAt)} (uploaded) ·{" "}
                        {formatDateTimeIstanbul(m.updatedAt)} (updated) · {m.slug}
                      </p>
                    </div>
                    {canManageManuals ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={deletingId === m.id}
                        onClick={() => void remove(m.id)}
                        aria-label="Delete archived revision"
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
      </div>
    </>
  )
}
