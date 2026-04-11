"use client"

import * as React from "react"
import {
  IconArchive,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { cn } from "@/lib/utils"

type FormRow = {
  id: number
  title: string
  slug: string
  createdAt: string
  updatedAt: string
  department: string
  revision: number
  isCurrent: boolean
  createdBy: number | null
  creator: {
    isim: string | null
    soyisim: string | null
    email: string
  } | null
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
    m.slug.toLowerCase().includes(s) ||
    m.department.toLowerCase().includes(s) ||
    `rev.${m.revision}`.includes(s) ||
    String(m.revision).includes(s) ||
    up.includes(s)
  )
}

export function DepartmentFormsClient() {
  const [items, setItems] = React.useState<FormRow[]>([])
  const [historicItems, setHistoricItems] = React.useState<FormRow[]>([])
  const [canManageAll, setCanManageAll] = React.useState(false)
  const [viewerDepartman, setViewerDepartman] = React.useState<string | null>(
    null
  )
  const [departmentOptions, setDepartmentOptions] = React.useState<string[]>(
    []
  )
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")

  const [title, setTitle] = React.useState("")
  const [department, setDepartment] = React.useState<string>("")
  const [uploadMode, setUploadMode] = React.useState<"new" | "revision">("new")
  const [supersedesId, setSupersedesId] = React.useState<string>("")
  const [revisionInput, setRevisionInput] = React.useState("1")
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

  const canWriteAny =
    canManageAll || Boolean((viewerDepartman ?? "").trim())

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
        historicForms?: FormRow[]
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
          revision: m.revision ?? 1,
          isCurrent: m.isCurrent ?? true,
          createdBy: m.createdBy ?? null,
          creator: m.creator ?? null,
        }))
      )
      setHistoricItems(
        Array.isArray(data.historicForms)
          ? data.historicForms.map((m) => ({
              ...m,
              revision: m.revision ?? 1,
              isCurrent: m.isCurrent ?? false,
              createdBy: m.createdBy ?? null,
              creator: m.creator ?? null,
            }))
          : []
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
      setHistoricItems([])
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

    setTitle("")
    setUploadMode("new")
    setSupersedesId("")
    setRevisionInput("1")
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (!canManageAll) {
      const v = (viewerDepartman ?? "").trim()
      if (v && departmentOptions.includes(v)) setDepartment(v)
    } else {
      setDepartment("")
    }
  }, [uploadOpen, canManageAll, viewerDepartman, departmentOptions])

  const resetUploadFields = () => {
    setTitle("")
    setUploadMode("new")
    setSupersedesId("")
    setRevisionInput("1")
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const revisionNumberValid = React.useMemo(() => {
    const n = Number.parseInt(revisionInput.trim(), 10)
    return Number.isFinite(n) && n >= 1 && n <= 999999
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
        text: "Revizyon 1–999999 arasında tam sayı olmalıdır.",
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
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("title", t)
      fd.append("department", deptValue)
      fd.append("revision", revisionInput.trim())
      fd.append("file", file)
      if (uploadMode === "revision") {
        fd.append("supersedesId", supersedesId)
      }
      const res = await fetch("/api/department-forms", { method: "POST", body: fd })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Yükleme başarısız")
      setBanner({
        type: "ok",
        text:
          uploadMode === "revision"
            ? "Yeni revizyon kaydedildi. Önceki güncel sürüm arşive taşındı."
            : "Form kaydedildi.",
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
        "Bu güncel revizyonu arşive taşıyalım mı? Seride tek kayıt varsa liste dışı kalır (arşiv sekmesinde görünür). Birden fazlaysa en yüksek eski revizyon tekrar güncel olur."
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
          ? "Revizyon arşivlendi — aşağıdaki Arşiv sekmesinden kontrol edebilirsiniz."
          : "Revizyon arşivlendi. Kendi departmanınızın eski sürümleri Arşiv sekmesinde görünür.",
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

  const filteredCurrent = React.useMemo(
    () => items.filter((m) => matchesSearch(m, search)),
    [items, search]
  )
  const filteredHistoric = React.useMemo(
    () => historicItems.filter((m) => matchesSearch(m, search)),
    [historicItems, search]
  )

  const revisionParentOptions = items.filter((m) => m.isCurrent !== false)

  const showHistoricTab = historicItems.length > 0 || canManageAll

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
          yükleyemezsiniz. <strong className="text-foreground">Quality</strong> ve{" "}
          <strong className="text-foreground">Admin</strong> tüm formlara erişir (hesap
          departmanı bu rollerden biri olmalıdır). Diğer kullanıcılar için yöneticiden
          departman ataması isteyin.
        </p>
      ) : null}

      {canManageAll ? (
        <p className="text-muted-foreground text-sm">
          <strong className="text-foreground">Quality</strong> ve{" "}
          <strong className="text-foreground">Admin</strong> tüm departman formlarını
          görür ve <strong className="text-foreground">Form yükle</strong> ile
          yükleyebilir. Diğer departmanlar yalnızca kendi formlarını görür ve yükler.
        </p>
      ) : canWriteAny ? (
        <p className="text-muted-foreground text-sm">
          Yalnızca <strong className="text-foreground">{viewerDepartman}</strong>{" "}
          departmanına ait formları görüyorsunuz. Yüklemek için{" "}
          <strong className="text-foreground">Form yükle</strong> düğmesini kullanın.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md">
          <Label htmlFor="dept-form-search" className="text-muted-foreground">
            Form ara
          </Label>
          <div className="flex gap-2">
            <Input
              id="dept-form-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Başlık, departman, yükleyen, revizyon…"
              className="flex-1"
            />
            <Button type="button" variant="secondary" className="shrink-0 gap-1.5">
              <IconSearch className="size-4" />
              Ara
            </Button>
          </div>
        </div>
        {canWriteAny ? (
          <Button
            type="button"
            className="shrink-0 gap-2 sm:self-end"
            onClick={() => setUploadOpen(true)}
          >
            <IconPlus className="size-4" />
            Form yükle
          </Button>
        ) : null}
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="flex max-h-[min(92vh,720px)] flex-col gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
            <DialogTitle>Form yükleme</DialogTitle>
            <DialogDescription>
              {DEPARTMENT_FORM_TYPES_USER_MESSAGE}. Her departman kendi formlarını yükler.
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
                "flex min-h-[132px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors hover:bg-muted/40",
                dragOver && "border-primary bg-primary/5",
                !dragOver && "border-muted-foreground/30 bg-muted/25"
              )}
            >
              <IconUpload className="text-muted-foreground size-9" />
              <span className="font-medium text-foreground">
                {file ? file.name : "Dosyayı buraya sürükleyin veya tıklayarak seçin"}
              </span>
              <span className="text-muted-foreground max-w-md text-xs leading-relaxed">
                {DEPARTMENT_FORM_TYPES_USER_MESSAGE}
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="df-modal-title">Form başlığı</Label>
                <Input
                  id="df-modal-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn. Uçuş günlüğü kontrol formu"
                />
              </div>
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
                <Label htmlFor="df-modal-rev">Revizyon no</Label>
                <Input
                  id="df-modal-rev"
                  value={revisionInput}
                  onChange={(e) => setRevisionInput(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
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
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Güncel form (yerine)</Label>
                  <Select value={supersedesId} onValueChange={setSupersedesId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Satır seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {revisionParentOptions.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.title} · {m.department} · Rev.{m.revision}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
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

      <Card className="border-muted bg-muted/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revizyon ve arşiv</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0 text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">Yeni form:</strong>{" "}
            <strong className="text-foreground">Form yükle</strong> penceresinden yeni
            seri seçin; departman ve revizyon ile dosyayı ekleyin.
          </p>
          <p>
            <strong className="text-foreground">Yeni revizyon:</strong> Aynı pencerede
            «Mevcut güncel satırın yeni revizyonu» ile güncel satırı seçin; önceki güncel
            sürüm arşive alınır.
          </p>
          <p>
            <strong className="text-foreground">Arşiv:</strong> Listede arşiv simgesi —
            eski sürümler Arşiv sekmesinde; Quality / Admin tüm arşivi görür.
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <Tabs defaultValue="current" className="w-full">
          <TabsList
            className={showHistoricTab ? "grid w-full grid-cols-2" : "grid w-full"}
          >
            <TabsTrigger value="current">Güncel formlar</TabsTrigger>
            {showHistoricTab ? (
              <TabsTrigger value="historic">Arşiv</TabsTrigger>
            ) : null}
          </TabsList>
          <TabsContent value="current" className="mt-4 space-y-3">
            {filteredCurrent.length === 0 ? (
              <p className="text-muted-foreground text-sm">Kayıt yok.</p>
            ) : (
              filteredCurrent.map((m) => (
                <Card key={m.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base leading-snug">
                        {m.title}
                      </CardTitle>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {m.department} · Rev. {m.revision} ·{" "}
                        {formatDateTimeIstanbul(m.updatedAt)} ·{" "}
                        {formatUploaderLabel(m)}
                      </p>
                    </div>
                    {canWriteAny ? (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          title="Günceli arşive taşı"
                          disabled={archivingId === m.id}
                          onClick={() => void archiveCurrent(m.id)}
                        >
                          <IconArchive className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          title="Sil"
                          disabled={deletingId === m.id}
                          onClick={() => void remove(m.id)}
                        >
                          <IconTrash className="size-4 text-destructive" />
                        </Button>
                      </div>
                    ) : null}
                  </CardHeader>
                </Card>
              ))
            )}
          </TabsContent>
          {showHistoricTab ? (
            <TabsContent value="historic" className="mt-4 space-y-3">
              {filteredHistoric.length === 0 ? (
                <p className="text-muted-foreground text-sm">Arşivde kayıt yok.</p>
              ) : (
                filteredHistoric.map((m) => (
                  <Card key={m.id} className="opacity-90">
                    <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base leading-snug">
                          {m.title}
                        </CardTitle>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {m.department} · Rev. {m.revision} (arşiv) ·{" "}
                          {formatDateTimeIstanbul(m.updatedAt)}
                        </p>
                      </div>
                      {canWriteAny ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          title="Sil"
                          disabled={deletingId === m.id}
                          onClick={() => void remove(m.id)}
                        >
                          <IconTrash className="size-4 text-destructive" />
                        </Button>
                      ) : null}
                    </CardHeader>
                  </Card>
                ))
              )}
            </TabsContent>
          ) : null}
        </Tabs>
      )}
    </div>
  )
}
