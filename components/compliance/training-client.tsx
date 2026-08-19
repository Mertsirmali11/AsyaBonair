"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  IconDownload,
  IconPaperclip,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateOnlyIstanbul } from "@/lib/date-format"
import {
  TRAINING_STATUS_LABEL,
  computeTrainingStatus,
  daysUntil,
  type TrainingStatus,
} from "@/lib/training-status"
import { uploadTrainingCertificateDirect } from "@/lib/client-training-upload"
import { EmployeeCombobox } from "@/components/employee-combobox"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { cn } from "@/lib/utils"

export type CalisanLite = { id: number; isim: string | null; soyisim: string | null; departman: string | null }

export type TrainingRecordRow = {
  id: number
  calisanId: number
  trainingName: string
  completionDate: string
  expiryDate: string | null
  certificateStoragePath: string | null
  certificateFileName: string | null
  notes: string | null
  calisan: CalisanLite
}

const STATUS_BADGE_CLASS: Record<TrainingStatus, string> = {
  valid: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  expiring: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  expired: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
  "no-expiry": "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700",
}

function personelLabel(c: CalisanLite): string {
  return `${c.isim ?? ""} ${c.soyisim ?? ""}`.trim() || `#${c.id}`
}

function certificateHref(path: string): string {
  return `/api/training/files/${path}`
}

function StatusBadge({ status, expiryDate }: { status: TrainingStatus; expiryDate: string | null }) {
  let extra = ""
  if (status === "expiring" && expiryDate) {
    const d = daysUntil(new Date(expiryDate))
    extra = ` (${d} gün)`
  } else if (status === "expired" && expiryDate) {
    const d = Math.abs(daysUntil(new Date(expiryDate)))
    extra = ` (${d} gün önce)`
  }
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", STATUS_BADGE_CLASS[status])}>
      {TRAINING_STATUS_LABEL[status]}
      {extra}
    </Badge>
  )
}

export function TrainingClient({
  initialRows,
  calisanlar,
  fixedCalisanId,
}: {
  initialRows: TrainingRecordRow[]
  calisanlar: CalisanLite[]
  /** Verilirse: personel bazlı detay ekranı — personel seçici gizlenir, filtreler kapanır. */
  fixedCalisanId?: number
}) {
  const router = useRouter()
  const uid = React.useId()
  const [rows, setRows] = React.useState<TrainingRecordRow[]>(initialRows)
  const [loading, setLoading] = React.useState(false)

  const [deptFilter, setDeptFilter] = React.useState<string>("__all__")
  const [statusFilter, setStatusFilter] = React.useState<string>("__all__")
  const [search, setSearch] = React.useState("")

  const [formOpen, setFormOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [calisanId, setCalisanId] = React.useState<string>(fixedCalisanId ? String(fixedCalisanId) : "")
  const [trainingName, setTrainingName] = React.useState("")
  const [completionDate, setCompletionDate] = React.useState("")
  const [expiryDate, setExpiryDate] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [certFile, setCertFile] = React.useState<File | null>(null)
  const [saving, setSaving] = React.useState(false)

  const [deleteTarget, setDeleteTarget] = React.useState<TrainingRecordRow | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const reload = React.useCallback(async () => {
    setLoading(true)
    try {
      const url = fixedCalisanId
        ? `/api/training?calisanId=${fixedCalisanId}`
        : "/api/training"
      const res = await fetch(url, { cache: "no-store" })
      const data = (await res.json().catch(() => [])) as TrainingRecordRow[]
      if (res.ok && Array.isArray(data)) setRows(data)
    } finally {
      setLoading(false)
    }
  }, [fixedCalisanId])

  const departmentOptions = React.useMemo(() => {
    const set = new Set<string>()
    for (const c of calisanlar) if (c.departman?.trim()) set.add(c.departman.trim())
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [calisanlar])

  const trainingNameSuggestions = React.useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) set.add(r.trainingName)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (deptFilter !== "__all__" && (r.calisan.departman ?? "") !== deptFilter) return false
      const status = computeTrainingStatus(r.expiryDate ? new Date(r.expiryDate) : null)
      if (statusFilter !== "__all__" && status !== statusFilter) return false
      if (!q) return true
      return [personelLabel(r.calisan), r.trainingName, r.calisan.departman ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
  }, [rows, deptFilter, statusFilter, search])

  const openCreate = () => {
    setEditingId(null)
    setCalisanId(fixedCalisanId ? String(fixedCalisanId) : "")
    setTrainingName("")
    setCompletionDate("")
    setExpiryDate("")
    setNotes("")
    setCertFile(null)
    setFormOpen(true)
  }

  const openEdit = (r: TrainingRecordRow) => {
    setEditingId(r.id)
    setCalisanId(String(r.calisanId))
    setTrainingName(r.trainingName)
    setCompletionDate(r.completionDate.slice(0, 10))
    setExpiryDate(r.expiryDate ? r.expiryDate.slice(0, 10) : "")
    setNotes(r.notes ?? "")
    setCertFile(null)
    setFormOpen(true)
  }

  const submitForm = async () => {
    if (!calisanId) {
      toast.error("Personel seçin.")
      return
    }
    if (!trainingName.trim()) {
      toast.error("Eğitim adı gerekli.")
      return
    }
    if (!completionDate) {
      toast.error("Tamamlanma tarihi gerekli.")
      return
    }
    setSaving(true)
    try {
      let certificate: { path: string; fileName: string } | undefined
      if (certFile) {
        certificate = await uploadTrainingCertificateDirect(certFile)
      }

      const payload: Record<string, unknown> = {
        trainingName: trainingName.trim(),
        completionDate,
        expiryDate: expiryDate || null,
        notes: notes.trim() || null,
      }
      if (editingId === null) payload.calisanId = Number(calisanId)
      if (certificate) payload.certificate = certificate

      const url = editingId === null ? "/api/training" : `/api/training/${editingId}`
      const res = await fetch(url, {
        method: editingId === null ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi.")

      toast.success(editingId === null ? "Eğitim kaydı oluşturuldu." : "Kayıt güncellendi.")
      setFormOpen(false)
      await reload()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi.")
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/training/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Kayıt silindi.")
      setDeleteTarget(null)
      await reload()
    } catch {
      toast.error("Silinemedi.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      {!fixedCalisanId && <SetWorkspacePageTitle title="Eğitim Takip" />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {fixedCalisanId ? "Personel Eğitim Kayıtları" : "Eğitim Takip"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Zorunlu personel eğitimleri ve geçerlilik takibi.
          </p>
        </div>
        <Button type="button" size="sm" className="gap-1.5" onClick={openCreate}>
          <IconPlus className="size-4" />
          Yeni Eğitim Kaydı
        </Button>
      </div>

      {!fixedCalisanId && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Personel veya eğitim adı ara…"
            className="h-9 max-w-xs"
          />
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue placeholder="Departman" />
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tüm durumlar</SelectItem>
              {(Object.keys(TRAINING_STATUS_LABEL) as TrainingStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {TRAINING_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="bg-card overflow-hidden rounded-lg border shadow-sm">
        <ScrollArea className="h-[min(65vh,700px)]">
          {/* containerClassName: Table'ın kendi overflow-x-auto sarmalayıcısı bilerek
              verilmiyor — ScrollArea'nın Viewport'u hem x hem y scroll'u tek elemanda
              yönetiyor; ayrı bir iç overflow-x-auto div sticky header'ı kırar (bkz.
              components/ui/table.tsx Table containerClassName açıklaması). */}
          <Table containerClassName="relative w-full">
          <TableHeader sticky>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {!fixedCalisanId && <TableHead>Personel</TableHead>}
              {!fixedCalisanId && <TableHead>Departman</TableHead>}
              <TableHead>Eğitim Adı</TableHead>
              <TableHead>Tamamlanma</TableHead>
              <TableHead>Geçerlilik</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="text-center">Sertifika</TableHead>
              <TableHead className="text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                  Yükleniyor…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                  Kayıt bulunamadı.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const status = computeTrainingStatus(r.expiryDate ? new Date(r.expiryDate) : null)
                return (
                  <TableRow key={r.id}>
                    {!fixedCalisanId && (
                      <TableCell className="font-medium">
                        <Link
                          href={`/compliance/training/${r.calisanId}`}
                          className="hover:text-primary hover:underline"
                        >
                          {personelLabel(r.calisan)}
                        </Link>
                      </TableCell>
                    )}
                    {!fixedCalisanId && (
                      <TableCell className="text-muted-foreground text-sm">
                        {r.calisan.departman ?? "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-sm">{r.trainingName}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDateOnlyIstanbul(r.completionDate)}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {r.expiryDate ? formatDateOnlyIstanbul(r.expiryDate) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={status} expiryDate={r.expiryDate} />
                    </TableCell>
                    <TableCell className="text-center">
                      {r.certificateStoragePath ? (
                        <a
                          href={certificateHref(r.certificateStoragePath)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={r.certificateFileName ?? "Sertifika"}
                          className="text-primary inline-flex items-center justify-center"
                        >
                          <IconDownload className="size-4" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => openEdit(r)}>
                          Düzenle
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive size-8"
                          onClick={() => setDeleteTarget(r)}
                          aria-label="Sil"
                        >
                          <IconTrash className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* ── Create/Edit dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId === null ? "Yeni Eğitim Kaydı" : "Eğitim Kaydını Düzenle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!fixedCalisanId && (
              <div className="space-y-2">
                <Label htmlFor={`tr-calisan-${uid}`}>Personel</Label>
                <EmployeeCombobox
                  id={`tr-calisan-${uid}`}
                  options={calisanlar.map((c) => ({
                    id: c.id,
                    label: personelLabel(c),
                    sublabel: c.departman ?? "",
                  }))}
                  value={calisanId ? Number(calisanId) : undefined}
                  onChange={(id) => setCalisanId(String(id))}
                  placeholder="Personel seçin…"
                  searchPlaceholder="İsim veya departman ara…"
                  disabled={editingId !== null}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`tr-name-${uid}`}>Eğitim Adı</Label>
              <Input
                id={`tr-name-${uid}`}
                list={`tr-name-list-${uid}`}
                value={trainingName}
                onChange={(e) => setTrainingName(e.target.value)}
                placeholder="ör. CRM, Tehlikeli Madde, Güvenlik Farkındalığı…"
              />
              <datalist id={`tr-name-list-${uid}`}>
                {trainingNameSuggestions.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`tr-completion-${uid}`}>Tamamlanma Tarihi</Label>
                <Input
                  id={`tr-completion-${uid}`}
                  type="date"
                  value={completionDate}
                  onChange={(e) => setCompletionDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`tr-expiry-${uid}`}>Geçerlilik / Yenileme Tarihi</Label>
                <Input
                  id={`tr-expiry-${uid}`}
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">Boş bırakılırsa süresiz kabul edilir.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`tr-cert-${uid}`}>Sertifika / Belge (isteğe bağlı)</Label>
              <Input
                id={`tr-cert-${uid}`}
                type="file"
                accept="application/pdf,.pdf,image/*"
                onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
                className="cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
              />
              {certFile ? (
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <IconPaperclip className="size-3.5 shrink-0" />
                  {certFile.name}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`tr-notes-${uid}`}>Not (isteğe bağlı)</Label>
              <Input
                id={`tr-notes-${uid}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Eklemek istediğiniz bir not…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Vazgeç
            </Button>
            <Button type="button" onClick={() => void submitForm()} disabled={saving}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kayıt silinsin mi?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {deleteTarget
              ? `“${deleteTarget.trainingName}” (${personelLabel(deleteTarget.calisan)}) kaydı kalıcı olarak silinecek.`
              : ""}
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Vazgeç
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Siliniyor…" : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
