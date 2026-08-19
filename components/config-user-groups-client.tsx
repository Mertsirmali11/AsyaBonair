"use client"

import * as React from "react"
import { Pencil, Plus, Trash2, Users } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmployeeMultiSelect } from "@/components/compliance/audit-plan-client"
import { sortRowsBy, useSortableTable } from "@/hooks/use-sortable-table"

type GroupMember = { id: number; name: string; department: string | null }
type GroupRow = {
  id: number
  name: string
  description: string | null
  members: GroupMember[]
  memberCount: number
  createdByName: string | null
  createdAt: string
}
type CalisanLite = { id: number; isim: string | null; soyisim: string | null; departman: string | null }

function calisanName(c: CalisanLite): string {
  return [c.isim, c.soyisim].filter(Boolean).join(" ").trim() || `#${c.id}`
}

async function parseJson(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try { return JSON.parse(t) as unknown } catch { return null }
}

type GroupSortColumn = "name" | "memberCount"

export function ConfigUserGroupsClient() {
  const [groups, setGroups] = React.useState<GroupRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [calisanlar, setCalisanlar] = React.useState<CalisanLite[]>([])
  const [departments, setDepartments] = React.useState<string[]>([])
  const { sortColumn, sortDir, toggleSort } = useSortableTable<GroupSortColumn>()

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/user-groups", { cache: "no-store" })
      const data = await parseJson(res)
      if (!res.ok || !Array.isArray(data)) { toast.error("Gruplar yüklenemedi."); return }
      setGroups(data as GroupRow[])
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
    void (async () => {
      try {
        const res = await fetch("/api/calisanlar")
        if (res.ok) setCalisanlar((await res.json()) as CalisanLite[])
      } catch { /* sessiz — Members alanı boş listeyle gösterilir */ }
    })()
    void (async () => {
      try {
        const res = await fetch("/api/organization-departments")
        const data = await parseJson(res) as { departments?: string[] } | null
        if (res.ok && data?.departments) setDepartments(data.departments)
      } catch { /* sessiz — "Add from Department" seçeneği boş kalır */ }
    })()
  }, [load])

  const employeeOptions = React.useMemo(
    () => calisanlar.map((c) => ({ id: c.id, label: calisanName(c) })),
    [calisanlar]
  )

  // ── Add Group ──────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [newDescription, setNewDescription] = React.useState("")
  const [newMemberIds, setNewMemberIds] = React.useState<number[]>([])
  const [creating, setCreating] = React.useState(false)
  const [quickAddDept, setQuickAddDept] = React.useState("")

  const openCreate = () => {
    setNewName("")
    setNewDescription("")
    setNewMemberIds([])
    setQuickAddDept("")
    setCreateOpen(true)
  }

  const addAllFromDepartment = (deptName: string, addTo: (ids: number[]) => void, current: number[]) => {
    const ids = calisanlar.filter((c) => c.departman === deptName).map((c) => c.id)
    if (ids.length === 0) {
      toast.error(`"${deptName}" departmanında çalışan bulunamadı.`)
      return
    }
    addTo(Array.from(new Set([...current, ...ids])))
    toast.success(`${ids.length} kişi "${deptName}" departmanından eklendi.`)
  }

  const submitCreate = async () => {
    const name = newName.trim()
    if (!name) { toast.error("Group Name zorunludur."); return }
    if (newMemberIds.length === 0) { toast.error("En az bir üye seçilmelidir."); return }
    setCreating(true)
    try {
      const res = await fetch("/api/user-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: newDescription.trim() || null, memberIds: newMemberIds }),
      })
      const data = await parseJson(res) as { error?: string } | null
      if (!res.ok) { toast.error((data && data.error) || "Grup oluşturulamadı."); return }
      toast.success("Grup oluşturuldu.")
      setCreateOpen(false)
      await load()
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setCreating(false)
    }
  }

  // ── Edit Group ─────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = React.useState<GroupRow | null>(null)
  const [editName, setEditName] = React.useState("")
  const [editDescription, setEditDescription] = React.useState("")
  const [editMemberIds, setEditMemberIds] = React.useState<number[]>([])
  const [saving, setSaving] = React.useState(false)
  const [editQuickAddDept, setEditQuickAddDept] = React.useState("")

  const openEdit = (g: GroupRow) => {
    setEditTarget(g)
    setEditName(g.name)
    setEditDescription(g.description ?? "")
    setEditMemberIds(g.members.map((m) => m.id))
    setEditQuickAddDept("")
  }

  const submitEdit = async () => {
    if (!editTarget) return
    const name = editName.trim()
    if (!name) { toast.error("Group Name zorunludur."); return }
    if (editMemberIds.length === 0) { toast.error("En az bir üye kalmalıdır."); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/user-groups/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: editDescription.trim() || null, memberIds: editMemberIds }),
      })
      const data = await parseJson(res) as { error?: string } | null
      if (!res.ok) { toast.error((data && data.error) || "Kaydedilemedi."); return }
      toast.success("Grup güncellendi.")
      setEditTarget(null)
      await load()
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setSaving(false)
    }
  }

  // ── Delete Group ───────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = React.useState<GroupRow | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const submitDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/user-groups/${deleteTarget.id}`, { method: "DELETE" })
      const data = await parseJson(res) as { error?: string } | null
      if (!res.ok) {
        // 409: açık bulgu var — API'nin döndürdüğü açıklayıcı mesajı olduğu gibi göster.
        toast.error((data && data.error) || "Silinemedi.", { duration: 8000 })
        return
      }
      toast.success("Grup silindi.")
      setDeleteTarget(null)
      await load()
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setDeleting(false)
    }
  }

  // Description/Members bilerek sortable değil — serbest metin / liste. Name ve
  // Member Count için client-side sıralama (yeni API/N+1 yok, halihazırda yüklü liste).
  const sortedGroups = React.useMemo(
    () =>
      sortRowsBy(groups, sortColumn, sortDir, (g, column) =>
        column === "name" ? g.name.trim().toLowerCase() : g.memberCount
      ),
    [groups, sortColumn, sortDir]
  )

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
        İstediğiniz isimde grup oluşturup istediğiniz çalışanları ekleyip çıkarabilirsiniz —
        departman kayıtlarından bağımsızdır. Gruplar özellikle{" "}
        <span className="text-foreground font-medium">Finding / CPA</span> atamalarında bir
        bulguyu tek kişiye veya bir gruba atamak için kullanılır.
      </p>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">User Groups</CardTitle>
            <CardDescription className="mt-1">Toplam {groups.length} grup</CardDescription>
          </div>
          <Button type="button" size="sm" className="shrink-0 gap-2" onClick={openCreate}>
            <Plus className="size-4" />
            Add Group
          </Button>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <div className="overflow-x-auto px-6 pb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    active={sortColumn === "name"}
                    direction={sortDir}
                    onClick={() => toggleSort("name")}
                  >
                    Group Name
                  </SortableTableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Members</TableHead>
                  <SortableTableHead
                    className="text-center"
                    active={sortColumn === "memberCount"}
                    direction={sortDir}
                    onClick={() => toggleSort("memberCount")}
                  >
                    Member Count
                  </SortableTableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground h-28 text-center text-sm">
                      Yükleniyor…
                    </TableCell>
                  </TableRow>
                ) : groups.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="text-muted-foreground py-10 text-center text-sm">
                      Henüz grup yok. «Add Group» ile oluşturun.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedGroups.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1.5">
                          <Users className="text-muted-foreground size-3.5 shrink-0" />
                          {g.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[280px] truncate text-sm" title={g.description ?? ""}>
                        {g.description || "—"}
                      </TableCell>
                      <TableCell className="max-w-[320px] text-sm">
                        <span className="line-clamp-2 text-muted-foreground">
                          {g.members.map((m) => m.name).join(", ") || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm">{g.memberCount}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon" title="Düzenle" onClick={() => openEdit(g)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Sil"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(g)}
                          >
                            <Trash2 className="size-4" />
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

      {/* ── Add Group Dialog ─────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(o) => !creating && setCreateOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Group</DialogTitle>
            <DialogDescription>
              Grup, departmandan bağımsızdır — sonradan istediğiniz kişiyi ekleyip çıkarabilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="group-new-name">Group Name *</Label>
              <Input
                id="group-new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Örn. SMS Department"
                maxLength={200}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="group-new-description">Description</Label>
              <Textarea
                id="group-new-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="İsteğe bağlı açıklama…"
                className="min-h-[70px]"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">Add all members from Department (isteğe bağlı, tek seferlik)</Label>
              <div className="flex gap-2">
                <Select value={quickAddDept} onValueChange={setQuickAddDept}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Departman seçin…" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!quickAddDept}
                  onClick={() => quickAddDept && addAllFromDepartment(quickAddDept, setNewMemberIds, newMemberIds)}
                >
                  Ekle
                </Button>
              </div>
            </div>
            <EmployeeMultiSelect
              id="group-new-members"
              label="Members *"
              options={employeeOptions}
              selectedIds={newMemberIds}
              onChange={setNewMemberIds}
              placeholder="Üye seçin…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
              Vazgeç
            </Button>
            <Button type="button" disabled={creating} onClick={() => void submitCreate()}>
              {creating ? "Oluşturuluyor…" : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Group Dialog ────────────────────────────────────────────── */}
      <Dialog open={editTarget !== null} onOpenChange={(o) => !o && !saving && setEditTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Grubu Düzenle</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="group-edit-name">Group Name *</Label>
              <Input id="group-edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={200} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="group-edit-description">Description</Label>
              <Textarea
                id="group-edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="min-h-[70px]"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">Add all members from Department (isteğe bağlı, tek seferlik)</Label>
              <div className="flex gap-2">
                <Select value={editQuickAddDept} onValueChange={setEditQuickAddDept}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Departman seçin…" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!editQuickAddDept}
                  onClick={() => editQuickAddDept && addAllFromDepartment(editQuickAddDept, setEditMemberIds, editMemberIds)}
                >
                  Ekle
                </Button>
              </div>
            </div>
            <EmployeeMultiSelect
              id="group-edit-members"
              label="Members *"
              options={employeeOptions}
              selectedIds={editMemberIds}
              onChange={setEditMemberIds}
              placeholder="Üye seçin…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setEditTarget(null)} disabled={saving}>
              Vazgeç
            </Button>
            <Button type="button" disabled={saving} onClick={() => void submitEdit()}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Group Confirm ─────────────────────────────────────────── */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Grubu sil?</DialogTitle>
            <DialogDescription asChild>
              <div className="text-muted-foreground text-sm leading-snug">
                {deleteTarget ? (
                  <>
                    <strong className="text-foreground">{deleteTarget.name}</strong> kalıcı olarak
                    silinecek (arşivlenecek). Bu gruba atanmış açık bir bulgu varsa silme
                    engellenir — önce bulguları başka bir kişiye/gruba yeniden atamanız gerekir.
                  </>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Vazgeç
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={() => void submitDelete()}>
              {deleting ? "Siliniyor…" : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
