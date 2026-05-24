"use client"

import * as React from "react"
import {
  IconArchive,
  IconChevronDown,
  IconEye,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react"
import { formatDateTimeIstanbul } from "@/lib/date-format"
import {
  DEPARTMENT_FORM_ACCEPT,
  DEPARTMENT_FORM_TYPES_USER_MESSAGE,
} from "@/lib/allowed-document-uploads"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

type FormRow = {
  id: number
  /** Kurumsal form numarası (örn. FRM-001) */
  formNumber: string
  title: string
  slug: string
  createdAt: string
  updatedAt: string
  department: string
  revision: number
  isCurrent: boolean
  status?: "approved" | "pending" | "rejected"
  rejectionReason?: string | null
  createdBy: number | null
  /** Yüklenen orijinal dosya depoda varsa PDF/Word/Excel yeni sekmede açılır */
  hasOriginalFile?: boolean
  documentPreview?: "pdf" | "none" | "unsupported"
  creator: {
    isim: string | null
    soyisim: string | null
    email: string
  } | null
  previousRevisions?: FormRow[]
}

function formatUploaderLabel(m: FormRow): string {
  const c = m.creator
  if (!c) return "—"
  const name = `${c.isim ?? ""} ${c.soyisim ?? ""}`.trim()
  if (name) return `${name} (${c.email})`
  return c.email
}

function matchesSearch(m: FormRow, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const up = formatUploaderLabel(m).toLowerCase()
  return (
    m.title.toLowerCase().includes(s) ||
    (m.formNumber ?? "").toLowerCase().includes(s) ||
    m.slug.toLowerCase().includes(s) ||
    m.department.toLowerCase().includes(s) ||
    `rev.${m.revision}`.includes(s) ||
    String(m.revision).includes(s) ||
    up.includes(s)
  )
}

export function DepartmentFormsClient() {
  const [items, setItems] = React.useState<FormRow[]>([])
  const [canManageAll, setCanManageAll] = React.useState(false)
  const [viewerDepartman, setViewerDepartman] = React.useState<string | null>(
    null
  )
  const [departmentOptions, setDepartmentOptions] = React.useState<string[]>(
    []
  )
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  /** Boş = tüm departmanlar (Admin); dolu = filtre */
  const [departmentFilter, setDepartmentFilter] = React.useState("")

  const [title, setTitle] = React.useState("")
  const [formNumber, setFormNumber] = React.useState("")
  const [department, setDepartment] = React.useState<string>("")
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
  const [dragOver, setDragOver] = React.useState(false)
  const [uploadOpen, setUploadOpen] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const prevUploadOpen = React.useRef(false)
  /** «Düzenle» ile açıldığında yükleme penceresi sıfırlanmasın */
  const skipUploadResetOnOpenRef = React.useRef(false)

  const [viewOpen, setViewOpen] = React.useState(false)
  const [viewLoading, setViewLoading] = React.useState(false)
  const [viewError, setViewError] = React.useState<string | null>(null)
  const [viewTitle, setViewTitle] = React.useState("")
  const [viewText, setViewText] = React.useState("")

  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailForm, setDetailForm] = React.useState<FormRow | null>(null)

  const canWriteAny =
    canManageAll || Boolean((viewerDepartman ?? "").trim())

  // ── Onay / Red ────────────────────────────────────────────────────────────
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [rejectTarget, setRejectTarget] = React.useState<FormRow | null>(null)
  const [rejectReason, setRejectReason] = React.useState("")
  const [approving, setApproving] = React.useState<number | null>(null)

  const handleApprove = React.useCallback(async (form: FormRow) => {
    setApproving(form.id)
    try {
      const res = await fetch(`/api/department-forms/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Onaylanamadı")
      setItems((prev) =>
        prev.map((m) => (m.id === form.id ? { ...m, status: "approved" as const, rejectionReason: null } : m))
      )
      setBanner({ type: "ok", text: `"${form.title}" onaylandı.` })
    } catch (e) {
      setBanner({ type: "err", text: e instanceof Error ? e.message : "Onaylanamadı" })
    } finally {
      setApproving(null)
    }
  }, [])

  const handleRejectSubmit = React.useCallback(async () => {
    if (!rejectTarget || !rejectReason.trim()) return
    const target = rejectTarget
    setRejectOpen(false)
    setRejectTarget(null)
    setRejectReason("")
    try {
      const res = await fetch(`/api/department-forms/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectReason.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Reddedilemedi")
      setItems((prev) =>
        prev.map((m) =>
          m.id === target.id ? { ...m, status: "rejected" as const, rejectionReason: rejectReason.trim() } : m
        )
      )
      setBanner({ type: "ok", text: `"${target.title}" reddedildi.` })
    } catch (e) {
      setBanner({ type: "err", text: e instanceof Error ? e.message : "Reddedilemedi" })
    }
  }, [rejectTarget, rejectReason])

  React.useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner(null), 6000)
    return () => window.clearTimeout(t)
  }, [banner])

  const pickFile = React.useCallback((list: FileList | null) => {
    const f = list?.[0]
    if (f) setFile(f)
  }, [])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/department-forms", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        forms?: FormRow[]
        canManageAllDepartmentForms?: boolean
        viewerDepartman?: string | null
        departmentOptions?: string[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "Liste yüklenemedi")
      const list = Array.isArray(data.forms) ? data.forms : []
      setItems(
        list.map((m) => ({
          ...m,
          formNumber: m.formNumber ?? "",
          revision: m.revision ?? 0,
          isCurrent: m.isCurrent ?? true,
          createdBy: m.createdBy ?? null,
          creator: m.creator ?? null,
          hasOriginalFile: m.hasOriginalFile,
          documentPreview: m.documentPreview ?? "none",
          status: (m.status ?? "approved") as FormRow["status"],
          rejectionReason: m.rejectionReason ?? null,
          previousRevisions: Array.isArray(m.previousRevisions)
            ? m.previousRevisions.map((p) => ({
                ...p,
                formNumber: p.formNumber ?? "",
                revision: p.revision ?? 0,
                creator: p.creator ?? null,
                documentPreview: p.documentPreview ?? "none",
              }))
            : [],
        }))
      )
      setCanManageAll(!!data.canManageAllDepartmentForms)
      const vd =
        data.viewerDepartman === undefined ? null : data.viewerDepartman
      setViewerDepartman(vd)
      const opts = Array.isArray(data.departmentOptions)
        ? data.departmentOptions
        : []
      setDepartmentOptions(opts)
      setDepartment((prev) => {
        if (prev.trim()) return prev
        if (!data.canManageAllDepartmentForms) {
          const t = (vd ?? "").trim()
          if (t && opts.includes(t)) return t
        }
        return prev
      })
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Liste yüklenemedi",
      })
      setItems([])
      setDepartmentOptions([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    const justOpened = uploadOpen && !prevUploadOpen.current
    prevUploadOpen.current = uploadOpen
    if (!justOpened) return

    if (skipUploadResetOnOpenRef.current) {
      skipUploadResetOnOpenRef.current = false
      return
    }

    setTitle("")
    setFormNumber("")
    setUploadMode("new")
    setSupersedesId("")
    setRevisionInput("0")
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (!canManageAll) {
      const v = (viewerDepartman ?? "").trim()
      if (v && departmentOptions.includes(v)) setDepartment(v)
    } else {
      setDepartment("")
    }
  }, [uploadOpen, canManageAll, viewerDepartman, departmentOptions])

  const openTextPreviewModal = React.useCallback(async (id: number) => {
    setViewOpen(true)
    setViewLoading(true)
    setViewError(null)
    setViewTitle("")
    setViewText("")
    try {
      const res = await fetch(`/api/department-forms/${id}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        form?: { title?: string; contentText?: string }
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error || "Form açılamadı")
      }
      const f = data.form
      if (!f?.title) {
        throw new Error("Yanıt geçersiz")
      }
      setViewTitle(f.title)
      setViewText((f.contentText ?? "").trim() || "(Çıkarılan metin boş.)")
    } catch (e) {
      setViewError(e instanceof Error ? e.message : "Form yüklenemedi")
    } finally {
      setViewLoading(false)
    }
  }, [])

  /** Orijinal dosya varsa yeni sekmede; yoksa (eski kayıt) metin önizlemesi */
  const openFormDocument = React.useCallback(
    async (m: FormRow) => {
      if (m.hasOriginalFile === true) {
        const url = `${window.location.origin}/api/department-forms/${m.id}/file`
        window.open(url, "_blank", "noopener,noreferrer")
        return
      }
      if (m.hasOriginalFile === false) {
        await openTextPreviewModal(m.id)
        return
      }
      const res = await fetch(`/api/department-forms/${m.id}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        form?: { hasOriginalFile?: boolean }
      }
      if (res.ok && data.form?.hasOriginalFile) {
        window.open(
          `${window.location.origin}/api/department-forms/${m.id}/file`,
          "_blank",
          "noopener,noreferrer"
        )
        return
      }
      await openTextPreviewModal(m.id)
    },
    [openTextPreviewModal]
  )

  const openEditRevision = React.useCallback(
    (m: FormRow) => {
      skipUploadResetOnOpenRef.current = true
      setTitle(m.title)
      setFormNumber(m.formNumber ?? "")
      setDepartment(m.department)
      setUploadMode("revision")
      setSupersedesId(String(m.id))
      setRevisionInput(String(Math.min(m.revision + 1, 999999)))
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      setUploadOpen(true)
    },
    []
  )

  const openFreshUpload = React.useCallback(() => {
    skipUploadResetOnOpenRef.current = false
    setUploadOpen(true)
  }, [])

  const resetUploadFields = () => {
    setTitle("")
    setFormNumber("")
    setUploadMode("new")
    setSupersedesId("")
    setRevisionInput("0")
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const revisionNumberValid = React.useMemo(() => {
    const n = Number.parseInt(revisionInput.trim(), 10)
    return Number.isFinite(n) && n >= 0 && n <= 999999
  }, [revisionInput])

  const departmentChoiceValid = React.useMemo(() => {
    return Boolean(department.trim()) && departmentOptions.length > 0
  }, [department, departmentOptions.length])

  const submit = async () => {
    const t = title.trim()
    const deptValue = department.trim()
    if (!t || !file || !deptValue || !departmentChoiceValid) {
      setBanner({
        type: "err",
        text: `Başlık, sahip departman ve dosya gerekli (${DEPARTMENT_FORM_TYPES_USER_MESSAGE}).`,
      })
      return
    }
    if (!revisionNumberValid) {
      setBanner({
        type: "err",
        text: "Revizyon 0–999999 arasında tam sayı olmalıdır.",
      })
      return
    }
    if (uploadMode === "revision") {
      const sid = Number.parseInt(supersedesId, 10)
      if (!Number.isFinite(sid) || sid < 1) {
        setBanner({
          type: "err",
          text: "Yeni revizyon için güncel form satırını seçin.",
        })
        return
      }
    } else if (!formNumber.trim()) {
      setBanner({
        type: "err",
        text: "Yeni form serisi için form numarası girin (örn. FRM-001).",
      })
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("title", t)
      fd.append("formNumber", formNumber.trim())
      fd.append("department", deptValue)
      fd.append("revision", revisionInput.trim())
      fd.append("file", file)
      if (uploadMode === "revision") {
        fd.append("supersedesId", supersedesId)
      }
      const res = await fetch("/api/department-forms", { method: "POST", body: fd })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        formNumber?: string
        title?: string
        revision?: number
        textExtractionFallback?: boolean
      }
      if (!res.ok) throw new Error(data.error || "Yükleme başarısız")
      const fn = (data.formNumber ?? formNumber).trim() || "—"
      const revN = data.revision ?? Number.parseInt(revisionInput.trim(), 10)
      const displayTitle = (data.title ?? t).trim()
      let okText = `Kayıt eklendi: ${fn} · Rev. ${revN} · ${displayTitle}`
      if (uploadMode === "revision") {
        okText += ". Önceki güncel sürüm arşive taşındı."
      }
      if (data.textExtractionFallback) {
        okText +=
          " Metin dosyadan otomatik çıkarılamadı; orijinal dosya yine de saklandı ve «Aç» ile görüntülenebilir."
      }
      setBanner({
        type: "ok",
        text: okText,
      })
      resetUploadFields()
      setUploadOpen(false)
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
        "Bu güncel revizyonu arşive taşıyalım mı? Seride tek kayıt varsa liste dışı kalır (eski revizyonlar bölümünde görünür). Birden fazlaysa en yüksek eski revizyon tekrar güncel olur."
      )
    ) {
      return
    }
    setArchivingId(id)
    try {
      const res = await fetch(`/api/department-forms/${id}/archive-current`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Arşivlenemedi")
      setBanner({
        type: "ok",
        text: canManageAll
          ? "Revizyon arşivlendi — ilgili satırın «Eski revizyonlar» akordeonunda görünür."
          : "Revizyon arşivlendi; eski sürüm aynı form satırının altında listelenir.",
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
    if (!confirm("Bu form satırını silmek istiyor musunuz?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/department-forms/${id}`, { method: "DELETE" })
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

  const itemsForList = React.useMemo(() => {
    if (!canManageAll) return items
    const d = departmentFilter.trim()
    if (!d) return items
    return items.filter((m) => m.department === d)
  }, [items, canManageAll, departmentFilter])

  const filteredCurrent = React.useMemo(
    () => itemsForList.filter((m) => matchesSearch(m, search)),
    [itemsForList, search]
  )

  const revisionParentOptions = items.filter((m) => m.isCurrent !== false)

  React.useEffect(() => {
    if (uploadMode !== "revision" || !supersedesId.trim()) return
    const id = Number.parseInt(supersedesId, 10)
    if (!Number.isFinite(id)) return
    const row = revisionParentOptions.find((r) => r.id === id)
    if (row) setFormNumber(row.formNumber ?? "")
  }, [uploadMode, supersedesId, revisionParentOptions])

  return (
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

      {!loading && !canWriteAny ? (
        <p className="text-muted-foreground text-sm">
          Hesabınıza departman atanmamış; kendi departmanınızın formlarını göremez veya
          yükleyemezsiniz. Tüm departman formlarını yalnızca{" "}
          <strong className="text-foreground">Admin</strong> görür ve yönetir. Diğer
          kullanıcılar yalnızca kendi departmanlarını görür; gerekirse yöneticiden
          departman ataması isteyin.
        </p>
      ) : null}

      {/* ── Onay Bekleyen Formlar (yalnızca admin) ── */}
      {canManageAll && items.some((m) => m.status === "pending") && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-amber-900">
            ⏳ Onay Bekleyen Yüklemeler ({items.filter((m) => m.status === "pending").length})
          </p>
          <div className="flex flex-col gap-2">
            {items
              .filter((m) => m.status === "pending")
              .map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-amber-950">{m.title}</p>
                    <p className="text-xs text-amber-700">
                      {formatUploaderLabel(m)} · {m.department}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="h-7 gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={approving === m.id}
                      onClick={() => void handleApprove(m)}
                    >
                      ✓ Onayla
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 gap-1"
                      onClick={() => { setRejectTarget(m); setRejectReason(""); setRejectOpen(true) }}
                    >
                      ✕ Reddet
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {canManageAll ? (
        <p className="text-muted-foreground text-sm">
          <strong className="text-foreground">Admin</strong> olarak tüm departman
          formlarını yönetebilirsiniz; departman filtresi &quot;Tüm departmanlar&quot;
          iken hepsi listelenir.{" "}
          <strong className="text-foreground">Form yükle</strong> ile herhangi bir
          departman adına yükleme yapabilirsiniz.
        </p>
      ) : canWriteAny ? (
        <p className="text-muted-foreground text-sm">
          Yalnızca <strong className="text-foreground">{viewerDepartman}</strong>{" "}
          departmanına ait formları görüyorsunuz. Yüklemek için{" "}
          <strong className="text-foreground">Form yükle</strong> düğmesini kullanın.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="dept-form-search" className="text-muted-foreground">
            Ara ve filtrele
          </Label>
          {canWriteAny ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
              onClick={() => openFreshUpload()}
            >
              <IconPlus className="size-4" />
              Form yükle
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {canManageAll ? (
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-xs">
              <Label htmlFor="dept-form-filter" className="text-muted-foreground text-xs">
                Departman
              </Label>
              <Select
                value={departmentFilter || "__all__"}
                onValueChange={(v) =>
                  setDepartmentFilter(v === "__all__" ? "" : v)
                }
              >
                <SelectTrigger id="dept-form-filter" className="w-full">
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
          ) : null}
          <div className="flex min-w-0 flex-1 gap-2">
            <Input
              id="dept-form-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Form no, başlık, departman, yükleyen, revizyon…"
              className="flex-1"
            />
            <Button type="button" variant="secondary" className="shrink-0 gap-1.5">
              <IconSearch className="size-4" />
              Ara
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="flex max-h-[min(92vh,800px)] flex-col gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
            <DialogTitle>Form yükleme</DialogTitle>
            <DialogDescription>
              {DEPARTMENT_FORM_TYPES_USER_MESSAGE}. Yeni seride{" "}
              <strong className="text-foreground">form numarası</strong> zorunludur.
              Revizyonda numara güncel satırdan gelir; önceki güncel sürüm listede
              akordeon altında eski revizyon olarak kalır.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept={DEPARTMENT_FORM_ACCEPT}
              tabIndex={-1}
              onChange={(e) => pickFile(e.target.files)}
            />

            <Card className="gap-0 py-4 shadow-sm">
              <CardHeader className="px-4 pb-3 pt-0">
                <CardTitle className="text-base">Form bilgileri (elle girin)</CardTitle>
                <CardDescription>
                  Önce form numarası, form adı ve revizyonu yazın. Yeni form serisinde
                  form numarası zorunludur.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-0">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="df-modal-formno">Form numarası</Label>
                    <Input
                      id="df-modal-formno"
                      value={formNumber}
                      onChange={(e) => setFormNumber(e.target.value)}
                      placeholder="Örn. BON-CMM-FR-002"
                      disabled={uploadMode === "revision"}
                      maxLength={80}
                      autoComplete="off"
                    />
                    {uploadMode === "revision" ? (
                      <p className="text-muted-foreground text-xs">
                        Revizyonda numara güncel satırdan gelir (salt okunur).
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        Listede ve aramada görünür; kurum içi referans.
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="df-modal-title">Form adı (başlık)</Label>
                    <Input
                      id="df-modal-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Örn. Compliance Monitoring System Auditor List"
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2 sm:max-w-[200px]">
                    <Label htmlFor="df-modal-rev">Revizyon no</Label>
                    <Input
                      id="df-modal-rev"
                      value={revisionInput}
                      onChange={(e) => setRevisionInput(e.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 border-primary/20 bg-muted/40 py-4 shadow-none">
              <CardHeader className="px-4 pb-2 pt-0">
                <CardTitle className="text-sm">Kayıt özeti</CardTitle>
                <CardDescription className="text-xs">
                  Girdiklerinizin özeti; yüklemeden önce kontrol edin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-0 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/70 pb-2">
                  <span className="text-muted-foreground shrink-0">Form no</span>
                  <span className="min-w-0 text-right font-medium break-all text-foreground">
                    {(formNumber ?? "").trim() || "—"}
                  </span>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/70 pb-2">
                  <span className="text-muted-foreground shrink-0">Revizyon</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {revisionNumberValid
                      ? `Rev. ${Number.parseInt(revisionInput.trim(), 10)}`
                      : "—"}
                  </span>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="text-muted-foreground shrink-0 pt-0.5">Form adı</span>
                  <span className="min-w-0 max-w-[85%] text-right font-medium leading-snug break-words text-foreground">
                    {title.trim() || "—"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Sahip departman</Label>
                <Select
                  value={department || undefined}
                  onValueChange={setDepartment}
                  disabled={!canManageAll && Boolean((viewerDepartman ?? "").trim())}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Departman seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentOptions.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!canManageAll ? (
                  <p className="text-muted-foreground text-xs">
                    Yalnızca kendi departmanınız seçilir.
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label>Yükleme türü</Label>
                <Select
                  value={uploadMode}
                  onValueChange={(v) =>
                    setUploadMode(v === "revision" ? "revision" : "new")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Yeni form serisi</SelectItem>
                    <SelectItem value="revision">
                      Mevcut güncel satırın yeni revizyonu
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {uploadMode === "revision" ? (
                <div className="grid gap-2">
                  <Label>Güncel form (yerine)</Label>
                  <Select value={supersedesId} onValueChange={setSupersedesId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Satır seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {revisionParentOptions.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {(m.formNumber ?? "").trim()
                            ? `[${(m.formNumber ?? "").trim()}] `
                            : ""}
                          {m.title} · {m.department} · Rev.{m.revision}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <div>
              <Label className="text-muted-foreground mb-2 block text-xs font-medium">
                Dosya ({DEPARTMENT_FORM_TYPES_USER_MESSAGE})
              </Label>
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDragOver(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDragOver(false)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDragOver(false)
                  pickFile(e.dataTransfer.files)
                }}
                className={cn(
                  "flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-center text-sm transition-colors hover:bg-muted/40",
                  dragOver && "border-primary bg-primary/5",
                  !dragOver && "border-muted-foreground/30 bg-muted/25"
                )}
              >
                <IconUpload className="text-muted-foreground size-8" />
                <span className="font-medium text-foreground">
                  {file ? file.name : "Dosyayı buraya sürükleyin veya tıklayarak seçin"}
                </span>
                {file ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-8"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ""
                    }}
                  >
                    Dosyayı kaldır
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 flex-col gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={resetUploadFields}
            >
              Formu temizle
            </Button>
            <Button type="button" variant="secondary" onClick={() => setUploadOpen(false)}>
              Kapat
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={uploading}
              onClick={() => void submit()}
            >
              <IconUpload className="size-4" />
              {uploading ? "Yükleniyor…" : "Formu yükle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={viewOpen}
        onOpenChange={(o) => {
          setViewOpen(o)
          if (!o) {
            setViewError(null)
            setViewTitle("")
            setViewText("")
          }
        }}
      >
        <DialogContent className="flex max-h-[min(88vh,640px)] flex-col gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
            <DialogTitle className="pr-8 leading-snug">
              {viewLoading ? "Form açılıyor…" : viewTitle || "Form"}
            </DialogTitle>
            <DialogDescription>
              Bu kayıt için orijinal dosya saklanmadığından yalnızca çıkarılmış metin
              gösterilir. Yeni yüklemelerde &quot;Aç&quot; doğrudan dosyayı açar.
              Güncellemek için <strong className="text-foreground">Düzenle</strong> ile
              yeni revizyon yükleyin.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 px-6 py-3">
            {viewLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : viewError ? (
              <p className="text-destructive text-sm">{viewError}</p>
            ) : (
              <ScrollArea className="h-[min(52vh,420px)] rounded-md border bg-muted/30 p-3">
                <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
                  {viewText}
                </pre>
              </ScrollArea>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setViewOpen(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Red nedeni dialog ── */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Formu Reddet</DialogTitle>
            <DialogDescription>
              {rejectTarget?.title} — red nedenini yazın. Yükleyen kullanıcı bunu görecek.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Label htmlFor="form-reject-reason">Red nedeni <span className="text-destructive">*</span></Label>
            <Textarea
              id="form-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Örn. Eksik imza, yanlış departman, güncel olmayan sürüm…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>İptal</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim()}
              onClick={() => void handleRejectSubmit()}
            >
              Reddet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setDetailForm(null)
        }}
      >
        <DialogContent className="flex max-h-[min(92vh,760px)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4">
            <DialogTitle className="pr-8 leading-snug">
              {detailForm?.title ?? "Form"}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-muted-foreground space-y-1 text-sm">
                {detailForm ? (
                  <>
                    <p>
                      {(detailForm.formNumber ?? "").trim()
                        ? `No: ${(detailForm.formNumber ?? "").trim()} · `
                        : ""}
                      Rev. {detailForm.revision} · {detailForm.department}
                    </p>
                    <p>Yükleyen: {formatUploaderLabel(detailForm)}</p>
                    <p>
                      {formatDateTimeIstanbul(detailForm.createdAt)} (yükleme) ·{" "}
                      {formatDateTimeIstanbul(detailForm.updatedAt)} (güncelleme)
                    </p>
                  </>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-2">
            {!detailForm ? null : detailForm.documentPreview === "pdf" ? (
              <>
                <p className="text-muted-foreground mb-2 text-xs">
                  PDF önizleme. Tam ekran için yeni sekmede açın.
                </p>
                <iframe
                  title={detailForm.title}
                  src={`/api/department-forms/${detailForm.id}/file`}
                  className="min-h-[min(52vh,480px)] w-full flex-1 rounded-md border bg-muted/30"
                />
              </>
            ) : detailForm.documentPreview === "unsupported" ? (
              <div className="text-muted-foreground space-y-3 text-sm">
                <p>
                  Bu dosya PDF değil; tarayıcıda gömülü önizleme yok. İndirerek
                  açabilirsiniz.
                </p>
                <Button type="button" variant="outline" size="sm" asChild>
                  <a
                    href={`/api/department-forms/${detailForm.id}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Dosyayı aç / indir
                  </a>
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Bu kayıtta saklı dosya yok veya önizleme yok. Metin için{" "}
                <button
                  type="button"
                  className="text-primary underline underline-offset-2"
                  onClick={() => void openTextPreviewModal(detailForm.id)}
                >
                  metin önizlemesi
                </button>
                .
              </p>
            )}
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4">
            {detailForm ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <a
                  href={`/api/department-forms/${detailForm.id}/file`}
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
                setDetailForm(null)
              }}
            >
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Yüklü formlar</CardTitle>
          <CardDescription>
            Satıra tıklayarak önizleyin. Eski revizyonlar her satırın altındaki
            akordeonda.
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
              {items.length === 0 ? "Henüz form yok." : "Filtre veya arama sonucu yok."}
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
                          setDetailForm(m)
                          setDetailOpen(true)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setDetailForm(m)
                            setDetailOpen(true)
                          }
                        }}
                      >
                        <p className="flex items-center gap-1.5 font-medium">
                          <IconEye
                            className="text-muted-foreground size-4 shrink-0"
                            aria-hidden
                          />
                          {(m.formNumber ?? "").trim()
                            ? `[${(m.formNumber ?? "").trim()}] `
                            : ""}
                          {m.title}
                          {m.status === "pending" && (
                            <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">⏳ Beklemede</span>
                          )}
                          {m.status === "rejected" && (
                            <span className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">✕ Reddedildi</span>
                          )}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Rev. {m.revision} · {m.department}
                          {" · "}
                          {formatUploaderLabel(m)}
                        </p>
                        {m.status === "rejected" && m.rejectionReason && (
                          <p className="text-xs text-red-600">Red nedeni: {m.rejectionReason}</p>
                        )}
                        <p className="text-muted-foreground text-xs">
                          {formatDateTimeIstanbul(m.createdAt)} (yükleme) ·{" "}
                          {formatDateTimeIstanbul(m.updatedAt)} (güncelleme) · {m.slug}
                        </p>
                      </div>
                      {canWriteAny ? (
                        <div className="flex shrink-0 flex-wrap items-center gap-1 border-t p-2 sm:border-border sm:border-l sm:border-t-0 sm:px-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            disabled={archivingId === m.id || deletingId === m.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditRevision(m)
                            }}
                            title="Yeni revizyon"
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
                            onClick={(e) => {
                              e.stopPropagation()
                              void archiveCurrent(m.id)
                            }}
                            aria-label="Arşivle"
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
                                  {(p.formNumber ?? "").trim()
                                    ? ` · No: ${(p.formNumber ?? "").trim()}`
                                    : ""}
                                </p>
                                <p className="text-muted-foreground">
                                  {p.department} · {formatUploaderLabel(p)}
                                </p>
                                <a
                                  className="mt-1 inline-block text-primary underline-offset-2 hover:underline"
                                  href={`/api/department-forms/${p.id}/file`}
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
  )
}
