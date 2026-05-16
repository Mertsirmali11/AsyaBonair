"use client"

import * as React from "react"
import { IconInfoCircle, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react"
import { toast } from "sonner"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type CustomRow = { id: number; name: string }

function parsePayload(data: unknown): {
  departments: string[]
  customDepartments: CustomRow[]
} | null {
  if (!data || typeof data !== "object") return null
  const o = data as Record<string, unknown>
  if (!Array.isArray(o.departments)) return null
  const deps = o.departments.filter((x): x is string => typeof x === "string")
  const custom = Array.isArray(o.customDepartments)
    ? o.customDepartments
        .map((raw) => {
          if (!raw || typeof raw !== "object") return null
          const r = raw as Record<string, unknown>
          const id = Number(r.id)
          const name = typeof r.name === "string" ? r.name : ""
          return Number.isInteger(id) && id >= 1 && name ? ({ id, name } as CustomRow) : null
        })
        .filter((x): x is CustomRow => x !== null)
    : []
  return { departments: deps, customDepartments: custom }
}

export function ConfigDepartmentsClient() {
  const [loading, setLoading] = React.useState(true)
  const [customRows, setCustomRows] = React.useState<CustomRow[]>([])
  const [createOpen, setCreateOpen] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [creating, setCreating] = React.useState(false)

  const [editRow, setEditRow] = React.useState<CustomRow | null>(null)
  const [editName, setEditName] = React.useState("")
  const [savingEdit, setSavingEdit] = React.useState(false)

  const [deleteRow, setDeleteRow] = React.useState<CustomRow | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/organization-departments", { cache: "no-store" })
      const raw = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof raw?.error === "string" ? raw.error : "Departmanlar yüklenemedi.")
        return
      }
      const p = parsePayload(raw)
      if (!p) {
        toast.error("Sunucu yanıtı geçersiz.")
        return
      }
      setCustomRows(p.customDepartments.sort((a, b) => a.name.localeCompare(b.name, "tr")))
    } catch {
      toast.error("Departmanlar yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const applyPayload = React.useCallback((raw: unknown) => {
    const p = parsePayload(raw)
    if (!p) return false
    setCustomRows(p.customDepartments.sort((a, b) => a.name.localeCompare(b.name, "tr")))
    return true
  }, [])

  const openEdit = (r: CustomRow) => {
    setEditRow(r)
    setEditName(r.name)
  }

  const submitCreate = async () => {
    const name = newName.trim()
    if (!name) {
      toast.error("Departman adı yazın.")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/organization-departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const raw = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof raw?.error === "string" ? raw.error : "Eklenemedi.")
        return
      }
      toast.success("Departman eklendi.")
      setCreateOpen(false)
      setNewName("")
      applyPayload(raw)
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setCreating(false)
    }
  }

  const submitEdit = async () => {
    if (!editRow) return
    const name = editName.trim()
    if (!name) {
      toast.error("Departman adı yazın.")
      return
    }
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/organization-departments/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const raw = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof raw?.error === "string" ? raw.error : "Kaydedilemedi.")
        return
      }
      toast.success("Departman güncellendi.")
      setEditRow(null)
      applyPayload(raw)
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setSavingEdit(false)
    }
  }

  const submitDelete = async () => {
    if (!deleteRow) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/organization-departments/${deleteRow.id}`, {
        method: "DELETE",
      })
      const raw = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof raw?.error === "string" ? raw.error : "Silinemedi.")
        return
      }
      toast.success("Departman kaldırıldı.")
      setDeleteRow(null)
      applyPayload(raw)
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setDeleting(false)
    }
  }

  const totalListed = customRows.length

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex flex-col gap-6">
        <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
          Tüm departman adları bu listede elle tanımlanır (
          <span className="text-foreground font-medium">Configurations → Departmanlar</span>
          ). Personel profilleri, manuel/evrak seçimleri ve formlarda görünen seçenekler buradan gelir. Bağlı{" "}
          <strong className="text-foreground">aktif çalışan</strong> veya{" "}
          <strong className="text-foreground">bekleyen kayıt başvurusu</strong> olan departman silinemez.
        </p>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Departmanlar</CardTitle>
              <CardDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>Toplam {totalListed} kayıt</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex shrink-0"
                      aria-label="Bilgi"
                    >
                      <IconInfoCircle className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-sm leading-snug">
                    Manuel’de &quot;özel etiket&quot; ile serbest yazılan departman, bu tabloda yoksa formlar/liste
                    modunda seçilemez; önce buraya aynı adı ekleyin veya manuel yüklerken özel etiket kullanın.
                  </TooltipContent>
                </Tooltip>
              </CardDescription>
            </div>
            <Button type="button" size="sm" className="shrink-0 gap-2" onClick={() => setCreateOpen(true)}>
              <IconPlus className="size-4" />
              Departman ekle
            </Button>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <div className="overflow-x-auto px-6 pb-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-muted-foreground h-28 text-center text-sm">
                        Yükleniyor…
                      </TableCell>
                    </TableRow>
                  ) : customRows.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={2} className="text-muted-foreground py-10 text-center text-sm">
                        Henüz departman yok. «Departman ekle» ile oluşturun.
                      </TableCell>
                    </TableRow>
                  ) : (
                    customRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Yeniden adlandır"
                              onClick={() => openEdit(r)}
                            >
                              <IconPencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Sil"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteRow(r)}
                            >
                              <IconTrash className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Departman ekle</DialogTitle>
            <DialogDescription>
              Ad, mevcut kayıtlarla çakışamaz (büyük/küçük harf ayrımı yapılmaz).
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <Label htmlFor="dept-new-name">Departman adı</Label>
              <Input
                id="dept-new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Örn. Lojistik"
                maxLength={100}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitCreate()
                }}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                İptal
              </Button>
              <Button type="button" disabled={creating} onClick={() => void submitCreate()}>
                {creating ? "Ekleniyor…" : "Ekle"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editRow !== null} onOpenChange={(o) => !o && setEditRow(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Departman adını güncelle</DialogTitle>
              <DialogDescription>
                Bu ada sahip çalışanların ve bekleyen kayıt başvurularının departman metni güncellenir.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <Label htmlFor="dept-edit-name">Departman adı</Label>
              <Input
                id="dept-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={100}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitEdit()
                }}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setEditRow(null)}>
                İptal
              </Button>
              <Button type="button" disabled={savingEdit} onClick={() => void submitEdit()}>
                {savingEdit ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteRow !== null} onOpenChange={(o) => !o && setDeleteRow(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Departmanı kaldır?</DialogTitle>
              <DialogDescription asChild>
                <div className="text-muted-foreground text-sm leading-snug">
                  {deleteRow ? (
                    <>
                      <strong className="text-foreground">{deleteRow.name}</strong>, seçim listelerinden kaldırılır.
                      Bu ada atanmış aktif çalışan veya <strong className="text-foreground">bekleyen</strong> kayıt
                      başvurusu varsa silme yapılmaz.
                    </>
                  ) : null}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDeleteRow(null)}>
                İptal
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                onClick={() => void submitDelete()}
              >
                {deleting ? "Kaldırılıyor…" : "Kaldır"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
