"use client"

import * as React from "react"
import {
  IconArchive,
  IconChevronDown,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
  IconVersions,
  IconEye,
} from "@tabler/icons-react"
import { formatDateTimeIstanbul } from "@/lib/date-format"
import {
  DOCUMENT_ACCEPT_HTML,
  isAllowedCorrespondenceDocumentFile,
} from "@/lib/allowed-document-uploads"
import { isValidCustomManualDepartment } from "@/lib/organization-departments"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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

type ManualRow = {
  id: number
  title: string
  slug: string
  createdAt: string
  updatedAt: string
  department: string | null
  manualNumber: string | null
  revisionDate: string | null
  revision: number
  isCurrent: boolean
  createdBy: number | null
  seriesId?: string
  documentPreview?: "pdf" | "none" | "unsupported"
  creator: {
    isim: string | null
    soyisim: string | null
    email: string
  } | null
  previousRevisions?: ManualRow[]
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
  const mn = (m.manualNumber ?? "").toLowerCase()
  return (
    m.title.toLowerCase().includes(s) ||
    m.slug.toLowerCase().includes(s) ||
    (m.department ?? "").toLowerCase().includes(s) ||
    mn.includes(s) ||
    `rev.${m.revision}`.includes(s) ||
    String(m.revision).includes(s) ||
    up.includes(s)
  )
}

const manualsHeaderHelp = <ManualsHeaderHelp />

export function ConfigManualsClient() {
  const [items, setItems] = React.useState<ManualRow[]>([])
  const [canManageManuals, setCanManageManuals] = React.useState(false)
  const [departmentOptions, setDepartmentOptions] = React.useState<string[]>(
    []
  )
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("")

  const [addOpen, setAddOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [manualNumber, setManualNumber] = React.useState("")
  const [revisionDate, setRevisionDate] = React.useState("")
  const [department, setDepartment] = React.useState<string>("")
  const [departmentTab, setDepartmentTab] = React.useState<"list" | "custom">("list")
  const [customDepartment, setCustomDepartment] = React.useState("")
  const [revisionInput, setRevisionInput] = React.useState("1")
  const [file, setFile] = React.useState<File | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<number | null>(null)
  const [archivingId, setArchivingId] = React.useState<number | null>(null)
  const [banner, setBanner] = React.useState<{
    type: "ok" | "err"
    text: string
  } | null>(null)

  const [metaOpen, setMetaOpen] = React.useState(false)
  const [metaRow, setMetaRow] = React.useState<ManualRow | null>(null)
  const [metaTitle, setMetaTitle] = React.useState("")
  const [metaDeptTab, setMetaDeptTab] = React.useState<"list" | "custom">("list")
  const [metaDepartment, setMetaDepartment] = React.useState("")
  const [metaCustomDepartment, setMetaCustomDepartment] = React.useState("")
  const [metaManualNumber, setMetaManualNumber] = React.useState("")
  const [metaRevisionDate, setMetaRevisionDate] = React.useState("")
  const [metaSaving, setMetaSaving] = React.useState(false)

  const [revOpen, setRevOpen] = React.useState(false)
  const [revRow, setRevRow] = React.useState<ManualRow | null>(null)
  const [revDeptTab, setRevDeptTab] = React.useState<"list" | "custom">("list")
  const [revDepartment, setRevDepartment] = React.useState("")
  const [revCustomDepartment, setRevCustomDepartment] = React.useState("")
  const [revRevision, setRevRevision] = React.useState("")
  const [revRevisionDate, setRevRevisionDate] = React.useState("")
  const [revFile, setRevFile] = React.useState<File | null>(null)
  const [revSaving, setRevSaving] = React.useState(false)

  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailManual, setDetailManual] = React.useState<ManualRow | null>(null)

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
        canManageManuals?: boolean
        departmentOptions?: string[]
        error?: string
      }
      if (!res.ok) {
        setBanner({
          type: "err",
          text:
            data.error ||
            `Manuel listesi yüklenemedi (${res.status}). Sayfayı yenileyin veya yöneticiye bildirin.`,
        })
        setItems([])
        setCanManageManuals(false)
        setDepartmentOptions([])
        return
      }
      const list = Array.isArray(data.manuals) ? data.manuals : []
      setItems(
        list.map((m) => ({
          ...m,
          revision: m.revision ?? 0,
          isCurrent: m.isCurrent ?? true,
          createdBy: m.createdBy ?? null,
          creator: m.creator ?? null,
          documentPreview: m.documentPreview ?? "none",
          manualNumber: m.manualNumber ?? null,
          revisionDate: m.revisionDate ?? null,
          previousRevisions: Array.isArray(m.previousRevisions)
            ? m.previousRevisions.map((p) => ({
                ...p,
                revision: p.revision ?? 0,
                creator: p.creator ?? null,
                documentPreview: p.documentPreview ?? "none",
                manualNumber: p.manualNumber ?? null,
                revisionDate: p.revisionDate ?? null,
              }))
            : [],
        }))
      )
      setCanManageManuals(!!data.canManageManuals)
      setDepartmentOptions(
        Array.isArray(data.departmentOptions) ? data.departmentOptions : []
      )
    } catch (e) {
      setBanner({
        type: "err",
        text:
          e instanceof Error
            ? e.message
            : "Manuel listesi yüklenemedi. Bağlantıyı kontrol edin.",
      })
      setItems([])
      setCanManageManuals(false)
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
    setManualNumber("")
    setRevisionDate("")
    setDepartment("")
    setDepartmentTab("list")
    setCustomDepartment("")
    setRevisionInput("1")
    setFile(null)
  }

  const revisionNumberValid = React.useMemo(() => {
    const n = Number.parseInt(revisionInput.trim(), 10)
    return Number.isFinite(n) && n >= 0 && n <= 999999
  }, [revisionInput])

  const revRevisionValid = React.useMemo(() => {
    const n = Number.parseInt(revRevision.trim(), 10)
    return Number.isFinite(n) && n >= 0 && n <= 999999
  }, [revRevision])

  const revDeptValid = React.useMemo(() => {
    if (revDeptTab === "list") {
      return Boolean(revDepartment.trim()) && departmentOptions.length > 0
    }
    return isValidCustomManualDepartment(revCustomDepartment)
  }, [revDeptTab, revDepartment, revCustomDepartment, departmentOptions.length])

  const revFileValid = React.useMemo(() => {
    if (!revFile || revFile.size === 0) return false
    return isAllowedCorrespondenceDocumentFile(revFile)
  }, [revFile])

  const resetMetaDialog = React.useCallback(() => {
    setMetaRow(null)
    setMetaSaving(false)
    setMetaTitle("")
    setMetaDeptTab("list")
    setMetaDepartment("")
    setMetaCustomDepartment("")
    setMetaManualNumber("")
    setMetaRevisionDate("")
  }, [])

  const resetRevDialog = React.useCallback(() => {
    setRevRow(null)
    setRevSaving(false)
    setRevDeptTab("list")
    setRevDepartment("")
    setRevCustomDepartment("")
    setRevRevision("")
    setRevRevisionDate("")
    setRevFile(null)
  }, [])

  const openMetaEdit = React.useCallback(
    (m: ManualRow) => {
      setMetaRow(m)
      setMetaOpen(true)
      setMetaTitle(m.title)
      const dep = (m.department ?? "").trim()
      if (dep && departmentOptions.includes(dep)) {
        setMetaDeptTab("list")
        setMetaDepartment(dep)
        setMetaCustomDepartment("")
      } else {
        setMetaDeptTab("custom")
        setMetaCustomDepartment(dep)
        setMetaDepartment("")
      }
      setMetaManualNumber(m.manualNumber ?? "")
      setMetaRevisionDate(m.revisionDate ?? "")
    },
    [departmentOptions]
  )

  const openRevision = React.useCallback(
    (m: ManualRow) => {
      setRevRow(m)
      setRevOpen(true)
      const dep = (m.department ?? "").trim()
      if (dep && departmentOptions.includes(dep)) {
        setRevDeptTab("list")
        setRevDepartment(dep)
        setRevCustomDepartment("")
      } else {
        setRevDeptTab("custom")
        setRevCustomDepartment(dep)
        setRevDepartment("")
      }
      setRevRevision(String(Math.max(0, m.revision ?? 0) + 1))
      setRevRevisionDate("")
      setRevFile(null)
    },
    [departmentOptions]
  )

  const submitMeta = async () => {
    if (!metaRow) return
    const t = metaTitle.trim()
    const deptValue =
      metaDeptTab === "list"
        ? metaDepartment.trim()
        : metaCustomDepartment.trim()
    if (!t || !deptValue) {
      setBanner({ type: "err", text: "Başlık ve departman gerekli." })
      return
    }
    if (metaDeptTab === "list" && departmentOptions.length > 0) {
      if (!departmentOptions.includes(deptValue)) {
        setBanner({ type: "err", text: "Geçerli bir departman seçin." })
        return
      }
    }
    if (metaDeptTab === "custom" && !isValidCustomManualDepartment(metaCustomDepartment)) {
      setBanner({
        type: "err",
        text: "Özel departman 1–100 karakter olmalıdır.",
      })
      return
    }
    setMetaSaving(true)
    try {
      const res = await fetch(`/api/manuals/${metaRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          department: deptValue,
          departmentMode: metaDeptTab,
          manualNumber: metaManualNumber.trim(),
          revisionDate: metaRevisionDate.trim() || null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi")
      setBanner({ type: "ok", text: "Manuel bilgileri güncellendi." })
      setMetaOpen(false)
      resetMetaDialog()
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Kaydedilemedi",
      })
    } finally {
      setMetaSaving(false)
    }
  }

  const submitRevision = async () => {
    if (!revRow) return
    const t = revRow.title.trim()
    const deptValue =
      revDeptTab === "list" ? revDepartment.trim() : revCustomDepartment.trim()
    if (!revFile || !revFileValid) {
      setBanner({
        type: "err",
        text: "Geçerli bir dosya seçin (PDF, Word, Excel veya PowerPoint).",
      })
      return
    }
    if (!t || !deptValue || !revDeptValid) {
      setBanner({
        type: "err",
        text: "Manuel adı eksik veya sahip departman geçersiz.",
      })
      return
    }
    if (!revRevisionValid) {
      setBanner({
        type: "err",
        text: "Revizyon numarası 0–999999 arasında tam sayı olmalıdır.",
      })
      return
    }
    setRevSaving(true)
    try {
      const fd = new FormData()
      fd.append("title", t)
      fd.append("department", deptValue)
      fd.append("departmentMode", revDeptTab)
      fd.append("revision", revRevision.trim())
      fd.append("supersedesId", String(revRow.id))
      fd.append("file", revFile)
      const mn = (revRow.manualNumber ?? "").trim()
      if (mn) {
        fd.append("manualNumber", mn)
      }
      if (revRevisionDate.trim()) {
        fd.append("revisionDate", revRevisionDate.trim())
      }
      const res = await fetch("/api/manuals", { method: "POST", body: fd })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Kayıt başarısız")
      setBanner({
        type: "ok",
        text:
          "Yeni revizyon kaydedildi. Önceki güncel sürüm arşive alındı; geçmiş aşağıda görünür.",
      })
      setRevOpen(false)
      resetRevDialog()
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Kayıt başarısız",
      })
    } finally {
      setRevSaving(false)
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
        text: "Manuel adı, departman ve dosya (PDF, Word, Excel veya PowerPoint) gerekli.",
      })
      return
    }
    if (!revisionNumberValid) {
      setBanner({
        type: "err",
        text: "Revizyon numarası 0–999999 arasında tam sayı olmalıdır.",
      })
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("title", t)
      fd.append("department", deptValue)
      fd.append("departmentMode", departmentTab)
      fd.append("revision", revisionInput.trim())
      fd.append("file", file)
      if (manualNumber.trim()) {
        fd.append("manualNumber", manualNumber.trim())
      }
      if (revisionDate.trim()) {
        fd.append("revisionDate", revisionDate.trim())
      }
      const res = await fetch("/api/manuals", { method: "POST", body: fd })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Yükleme başarısız")
      setBanner({
        type: "ok",
        text: "Manuel kaydedildi; Bonair AI sohbetinde seçilebilir.",
      })
      resetAddForm()
      setAddOpen(false)
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Yükleme başarısız",
      })
    } finally {
      setUploading(false)
    }
  }

  const archiveCurrent = async (id: number) => {
    if (
      !confirm(
        "Bu güncel revizyonu önceki sürümlere taşımak istiyor musunuz? Seride tek satır varsa listeden kaybolur; Bonair AI için yeni revizyon yüklemeniz gerekir."
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
      if (!res.ok) throw new Error(data.error || "Arşivlenemedi")
      setBanner({
        type: "ok",
        text: "Revizyon arşive alındı.",
      })
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Arşivlenemedi",
      })
    } finally {
      setArchivingId(null)
    }
  }

  const remove = async (id: number) => {
    if (!confirm("Bu manuel satırını silmek istiyor musunuz?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/manuals/${id}`, { method: "DELETE" })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Silinemedi")
      setBanner({ type: "ok", text: "Silindi." })
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Silinemedi",
      })
    } finally {
      setDeletingId(null)
    }
  }

  const filteredCurrent = React.useMemo(() => {
    let list = items.filter((m) => matchesManualSearch(m, search))
    if (departmentFilter.trim()) {
      list = list.filter((m) => (m.department ?? "") === departmentFilter)
    }
    return list
  }, [items, search, departmentFilter])

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

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="manual-search" className="text-muted-foreground">
            Ara ve filtrele
          </Label>
          {canManageManuals ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
              title="Yeni manuel yükle"
              onClick={() => {
                resetAddForm()
                setAddOpen(true)
              }}
            >
              <IconPlus className="size-4" />
              Yeni manuel
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-xs">
            <Label htmlFor="manual-dept-filter" className="text-muted-foreground text-xs">
              Departman
            </Label>
            <Select
              value={departmentFilter || "__all__"}
              onValueChange={(v) =>
                setDepartmentFilter(v === "__all__" ? "" : v)
              }
            >
              <SelectTrigger id="manual-dept-filter" className="w-full">
                <SelectValue placeholder="Tüm departmanlar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tüm departmanlar</SelectItem>
                {departmentOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-1 gap-2">
            <Input
              id="manual-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Başlık, manuel no, departman, yükleyen, revizyon…"
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
            <DialogTitle>Yeni manuel yükle</DialogTitle>
            <DialogDescription>
              Departman, manuel bilgileri ve dosyayı girin. Metin dosyadan çıkarılır
              (Bonair AI). Arşivdeki eski sürümler her kullanıcıya akordeon altında
              gösterilir.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="modal-manual-title">Manuel adı</Label>
              <Input
                id="modal-manual-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn. Operations Manual Part A"
                disabled={uploading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-manual-no">Manuel no</Label>
              <Input
                id="modal-manual-no"
                value={manualNumber}
                onChange={(e) => setManualNumber(e.target.value)}
                placeholder="Örn. OM-A, MNL-001"
                disabled={uploading}
                maxLength={120}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="modal-manual-revision">Revizyon no</Label>
                <Input
                  id="modal-manual-revision"
                  type="number"
                  min={0}
                  max={999999}
                  step={1}
                  inputMode="numeric"
                  value={revisionInput}
                  onChange={(e) => setRevisionInput(e.target.value)}
                  placeholder="1"
                  disabled={uploading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-revision-date">Revizyon tarihi</Label>
                <Input
                  id="modal-revision-date"
                  type="date"
                  value={revisionDate}
                  onChange={(e) => setRevisionDate(e.target.value)}
                  disabled={uploading}
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label>Departman</Label>
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
                    Standart liste
                  </TabsTrigger>
                  <TabsTrigger value="custom" disabled={uploading}>
                    Özel etiket
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="list" className="mt-2 space-y-2">
                  <Select
                    value={department || undefined}
                    onValueChange={setDepartment}
                    disabled={uploading || departmentOptions.length === 0}
                  >
                    <SelectTrigger id="modal-manual-department" className="w-full">
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
                    id="modal-manual-department-custom"
                    value={customDepartment}
                    onChange={(e) => setCustomDepartment(e.target.value)}
                    placeholder="Örn. proje adı"
                    disabled={uploading}
                    maxLength={100}
                  />
                </TabsContent>
              </Tabs>
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-manual-file">Dosya (PDF, Word, Excel, PowerPoint)</Label>
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
              İptal
            </Button>
            <Button
              type="button"
              disabled={
                uploading ||
                !title.trim() ||
                !departmentChoiceValid ||
                !revisionNumberValid ||
                !file
              }
              className="gap-2"
              onClick={() => void submit()}
            >
              <IconUpload className="size-4" />
              {uploading ? "Yükleniyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={metaOpen}
        onOpenChange={(open) => {
          setMetaOpen(open)
          if (!open) resetMetaDialog()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manuel bilgilerini düzenle</DialogTitle>
            <DialogDescription>
              Yalnızca başlık, manuel no, departman ve revizyon tarihi güncellenir.
              Dosya değişikliği için <strong className="text-foreground">Revizyon</strong>{" "}
              kullanın.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="meta-title">Manuel adı</Label>
              <Input
                id="meta-title"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                disabled={metaSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta-manual-no">Manuel no</Label>
              <Input
                id="meta-manual-no"
                value={metaManualNumber}
                onChange={(e) => setMetaManualNumber(e.target.value)}
                disabled={metaSaving}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta-rev-date">Revizyon tarihi</Label>
              <Input
                id="meta-rev-date"
                type="date"
                value={metaRevisionDate}
                onChange={(e) => setMetaRevisionDate(e.target.value)}
                disabled={metaSaving}
              />
            </div>
            <div className="space-y-3">
              <Label>Departman</Label>
              <Tabs
                value={metaDeptTab}
                onValueChange={(v) => {
                  const next = v as "list" | "custom"
                  setMetaDeptTab(next)
                  if (next === "list") setMetaCustomDepartment("")
                  else setMetaDepartment("")
                }}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="list" disabled={metaSaving}>
                    Standart liste
                  </TabsTrigger>
                  <TabsTrigger value="custom" disabled={metaSaving}>
                    Özel etiket
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="list" className="mt-2">
                  <Select
                    value={metaDepartment || undefined}
                    onValueChange={setMetaDepartment}
                    disabled={metaSaving || departmentOptions.length === 0}
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
                <TabsContent value="custom" className="mt-2">
                  <Input
                    value={metaCustomDepartment}
                    onChange={(e) => setMetaCustomDepartment(e.target.value)}
                    disabled={metaSaving}
                    maxLength={100}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={metaSaving}
              onClick={() => {
                setMetaOpen(false)
                resetMetaDialog()
              }}
            >
              İptal
            </Button>
            <Button
              type="button"
              disabled={
                metaSaving ||
                !metaTitle.trim() ||
                (metaDeptTab === "list" && !metaDepartment.trim()) ||
                (metaDeptTab === "custom" && !isValidCustomManualDepartment(metaCustomDepartment))
              }
              onClick={() => void submitMeta()}
            >
              {metaSaving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revOpen}
        onOpenChange={(open) => {
          setRevOpen(open)
          if (!open) resetRevDialog()
        }}
      >
        <DialogContent className="max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconVersions className="size-5" />
              Yeni revizyon yükle
            </DialogTitle>
            <DialogDescription>
              Güncellenmiş dosyayı yükleyin. Önceki güncel sürüm otomatik olarak arşive
              alınır; geçmiş aşağıdaki akordeonda listelenir.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rev-title">Manuel adı</Label>
              <Input
                id="rev-title"
                readOnly
                value={revRow?.title ?? ""}
                tabIndex={-1}
                className="cursor-default bg-muted/60 text-foreground"
                aria-readonly
              />
              <p className="text-muted-foreground text-xs">
                Revizyonda manuel adı değişmez; gerekirse «Düzenle» ile güncel metayı
                düzenleyin.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rev-manual-no">Manuel no</Label>
              <Input
                id="rev-manual-no"
                readOnly
                value={revRow?.manualNumber ?? ""}
                placeholder="—"
                tabIndex={-1}
                className="cursor-default bg-muted/60 text-foreground"
                aria-readonly
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rev-revision">Yeni revizyon no</Label>
                <Input
                  id="rev-revision"
                  type="number"
                  min={0}
                  max={999999}
                  step={1}
                  inputMode="numeric"
                  value={revRevision}
                  onChange={(e) => setRevRevision(e.target.value)}
                  disabled={revSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rev-revision-date">Revizyon tarihi</Label>
                <Input
                  id="rev-revision-date"
                  type="date"
                  value={revRevisionDate}
                  onChange={(e) => setRevRevisionDate(e.target.value)}
                  disabled={revSaving}
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label>Sahip departman</Label>
              <Tabs
                value={revDeptTab}
                onValueChange={(v) => {
                  const next = v as "list" | "custom"
                  setRevDeptTab(next)
                  if (next === "list") setRevCustomDepartment("")
                  else setRevDepartment("")
                }}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="list" disabled={revSaving}>
                    Standart liste
                  </TabsTrigger>
                  <TabsTrigger value="custom" disabled={revSaving}>
                    Özel etiket
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="list" className="mt-2">
                  <Select
                    value={revDepartment || undefined}
                    onValueChange={setRevDepartment}
                    disabled={revSaving || departmentOptions.length === 0}
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
                <TabsContent value="custom" className="mt-2">
                  <Input
                    value={revCustomDepartment}
                    onChange={(e) => setRevCustomDepartment(e.target.value)}
                    disabled={revSaving}
                    maxLength={100}
                  />
                </TabsContent>
              </Tabs>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rev-file">Yeni dosya</Label>
              <Input
                id="rev-file"
                type="file"
                accept={DOCUMENT_ACCEPT_HTML}
                disabled={revSaving}
                onChange={(e) => setRevFile(e.target.files?.[0] ?? null)}
              />
              {revFile && !revFileValid ? (
                <p className="text-destructive text-xs">
                  Yalnızca PDF, Word, Excel veya PowerPoint seçin.
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={revSaving}
              onClick={() => {
                setRevOpen(false)
                resetRevDialog()
              }}
            >
              İptal
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={
                revSaving ||
                !revFileValid ||
                !(revRow?.title ?? "").trim() ||
                !revDeptValid ||
                !revRevisionValid
              }
              onClick={() => void submitRevision()}
            >
              <IconUpload className="size-4" />
              {revSaving ? "Kaydediliyor…" : "Revizyonu kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setDetailManual(null)
        }}
      >
        <DialogContent className="flex max-h-[min(92vh,760px)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4">
            <DialogTitle className="pr-8">
              {detailManual?.title ?? "Manuel"}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-muted-foreground space-y-1 text-sm">
                {detailManual ? (
                  <>
                    <p>
                      Rev. {detailManual.revision ?? 0}
                      {detailManual.manualNumber
                        ? ` · No: ${detailManual.manualNumber}`
                        : ""}
                      {detailManual.revisionDate
                        ? ` · Rev. tarihi: ${detailManual.revisionDate}`
                        : ""}
                      {detailManual.department
                        ? ` · ${detailManual.department}`
                        : ""}
                    </p>
                    <p>Yükleyen: {formatUploaderLabel(detailManual)}</p>
                    <p>
                      {formatDateTimeIstanbul(detailManual.createdAt)} (yükleme) ·{" "}
                      {formatDateTimeIstanbul(detailManual.updatedAt)} (güncelleme)
                    </p>
                  </>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-2">
            {!detailManual ? null : detailManual.documentPreview === "pdf" ? (
              <>
                <p className="text-muted-foreground mb-2 text-xs">
                  PDF önizleme. Düzenlemek için indirip masaüstü uygulamasında açın.
                </p>
                <iframe
                  title="Manuel PDF"
                  src={`/api/manuals/${detailManual.id}/file`}
                  className="min-h-[min(52vh,480px)] w-full flex-1 rounded-md border bg-muted/30"
                />
              </>
            ) : detailManual.documentPreview === "unsupported" ? (
              <div className="text-muted-foreground space-y-3 text-sm">
                <p>
                  Bu dosya PDF değil; tarayıcıda gömülü önizleme yok. İndirerek
                  açabilirsiniz.
                </p>
                <Button type="button" variant="outline" size="sm" asChild>
                  <a
                    href={`/api/manuals/${detailManual.id}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Dosyayı indir / aç
                  </a>
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Bu kayıtta saklı dosya yok veya önizleme desteklenmiyor.
              </p>
            )}
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4">
            {detailManual ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <a
                  href={`/api/manuals/${detailManual.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Yeni sekmede aç / indir
                </a>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDetailOpen(false)
                setDetailManual(null)
              }}
            >
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Yüklü manueller</CardTitle>
          <CardDescription>
            Güncel sürümler listede; bir manuelin dosyasını ve bilgilerini görmek için
            satıra tıklayın. Eski revizyonlar satırın altındaki akordeonda. Üst başlıktaki{" "}
            <span className="font-medium text-foreground">?</span> simgesinden ek bilgi
            alabilirsiniz.
            {canManageManuals
              ? " Yeni sürüm yüklendiğinde önceki otomatik arşive alınır."
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
                ? "Henüz manuel yok."
                : "Filtre veya arama sonucu yok."}
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {filteredCurrent.map((m) => {
                const prev = m.previousRevisions ?? []
                return (
                  <li key={m.id} className="p-0">
                    <div className="flex flex-wrap items-stretch justify-between gap-0 text-sm sm:items-center">
                      <div
                        role="button"
                        tabIndex={0}
                        className="min-w-0 flex-1 cursor-pointer rounded-md px-3 py-3 text-left outline-none ring-offset-background hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => {
                          setDetailManual(m)
                          setDetailOpen(true)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setDetailManual(m)
                            setDetailOpen(true)
                          }
                        }}
                      >
                        <p className="flex items-center gap-1.5 font-medium">
                          <IconEye
                            className="text-muted-foreground size-4 shrink-0"
                            aria-hidden
                          />
                          {m.title}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Rev. {m.revision ?? 0}
                          {m.manualNumber ? ` · No: ${m.manualNumber}` : ""}
                          {m.revisionDate
                            ? ` · Rev. tarihi: ${m.revisionDate}`
                            : ""}
                          {m.department ? ` · ${m.department}` : ""}
                          {" · "}
                          Yükleyen: {formatUploaderLabel(m)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatDateTimeIstanbul(m.createdAt)} (yükleme) ·{" "}
                          {formatDateTimeIstanbul(m.updatedAt)} (güncelleme) · {m.slug}
                        </p>
                      </div>
                      {canManageManuals ? (
                        <div className="flex shrink-0 flex-wrap items-center gap-1 border-t p-2 sm:border-border sm:border-l sm:border-t-0 sm:px-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            disabled={archivingId === m.id || deletingId === m.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              openMetaEdit(m)
                            }}
                            title="Bilgileri düzenle (dosya değil)"
                            aria-label="Düzenle"
                          >
                            <IconPencil className="size-4 shrink-0" />
                            <span className="hidden sm:inline">Düzenle</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            disabled={archivingId === m.id || deletingId === m.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              openRevision(m)
                            }}
                            title="Yeni revizyon yükle"
                            aria-label="Revizyon"
                          >
                            <IconVersions className="size-4 shrink-0" />
                            <span className="hidden sm:inline">Revizyon</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:bg-muted hover:text-foreground"
                            disabled={archivingId === m.id || deletingId === m.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              void archiveCurrent(m.id)
                            }}
                            aria-label="Arşive al"
                            title="Arşive al"
                          >
                            <IconArchive className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            disabled={deletingId === m.id || archivingId === m.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              void remove(m.id)
                            }}
                            aria-label="Sil"
                          >
                            <IconTrash className="size-4" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    {prev.length > 0 ? (
                      <Collapsible className="border-t bg-muted/20 px-3 py-1">
                        <CollapsibleTrigger className="flex w-full items-center gap-2 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground [&[data-state=open]>svg]:rotate-180">
                          <IconChevronDown className="size-4 shrink-0 transition-transform duration-200" />
                          Eski revizyonlar ({prev.length})
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <ul className="space-y-2 pb-3 pl-6">
                            {prev.map((p) => (
                              <li
                                key={p.id}
                                className="rounded-md border border-border/60 bg-background/80 p-2 text-xs"
                              >
                                <p className="font-medium text-muted-foreground">
                                  Rev. {p.revision}
                                  {p.manualNumber ? ` · No: ${p.manualNumber}` : ""}
                                  {p.revisionDate
                                    ? ` · ${p.revisionDate}`
                                    : ""}
                                </p>
                                <p className="text-muted-foreground">
                                  {p.department ? `${p.department} · ` : ""}
                                  {formatUploaderLabel(p)}
                                </p>
                                <p className="text-muted-foreground">
                                  {formatDateTimeIstanbul(p.createdAt)} · {p.slug}
                                </p>
                                <a
                                  className="mt-1 inline-block text-primary underline-offset-2 hover:underline"
                                  href={`/api/manuals/${p.id}/file`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Dosyayı aç / indir
                                </a>
                              </li>
                            ))}
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      </div>
    </>
  )
}
