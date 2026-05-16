"use client"

import * as React from "react"
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react"
import { toast } from "sonner"
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

export type AuditCategoryTypeRow = {
  id: number
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type AuditSubCategoryTypeRow = {
  id: number
  name: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

async function parseJsonBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function toastHttpError(res: Response, data: unknown, fallback: string) {
  const msg =
    data &&
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
      ? (data as { error: string }).error.trim()
      : ""
  toast.error(msg || `${fallback} (${res.status})`)
}

export function ConfigAuditSettingsClient() {
  const uid = React.useId()
  const subUid = React.useId()
  const [rows, setRows] = React.useState<AuditCategoryTypeRow[]>([])
  const [loading, setLoading] = React.useState(true)

  const [createOpen, setCreateOpen] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [newDescription, setNewDescription] = React.useState("")
  const [newSort, setNewSort] = React.useState("")
  const [creating, setCreating] = React.useState(false)

  const [editRow, setEditRow] = React.useState<AuditCategoryTypeRow | null>(null)
  const [editName, setEditName] = React.useState("")
  const [editDescription, setEditDescription] = React.useState("")
  const [editSort, setEditSort] = React.useState("")
  const [editActive, setEditActive] = React.useState(true)
  const [savingEdit, setSavingEdit] = React.useState(false)

  const [deleteTarget, setDeleteTarget] = React.useState<AuditCategoryTypeRow | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const [subParentId, setSubParentId] = React.useState<number | null>(null)
  const [subRows, setSubRows] = React.useState<AuditSubCategoryTypeRow[]>([])
  const [loadingSubs, setLoadingSubs] = React.useState(false)

  const [subCreateOpen, setSubCreateOpen] = React.useState(false)
  const [subNewName, setSubNewName] = React.useState("")
  const [subNewSort, setSubNewSort] = React.useState("")
  const [subCreating, setSubCreating] = React.useState(false)

  const [subEditRow, setSubEditRow] = React.useState<AuditSubCategoryTypeRow | null>(null)
  const [subEditName, setSubEditName] = React.useState("")
  const [subEditSort, setSubEditSort] = React.useState("")
  const [subEditActive, setSubEditActive] = React.useState(true)
  const [subSavingEdit, setSubSavingEdit] = React.useState(false)

  const [subDeleteTarget, setSubDeleteTarget] = React.useState<AuditSubCategoryTypeRow | null>(null)
  const [subDeleting, setSubDeleting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/audit-category-types?all=1", { cache: "no-store" })
      const data = await parseJsonBody(res)
      if (!res.ok) {
        toastHttpError(res, data, "Could not load")
        setRows([])
        return
      }
      setRows(Array.isArray(data) ? (data as AuditCategoryTypeRow[]) : [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSubs = React.useCallback(async (categoryId: number) => {
    setLoadingSubs(true)
    try {
      const res = await fetch(
        `/api/audit-subcategory-types?categoryTypeId=${categoryId}&all=1`,
        { cache: "no-store" }
      )
      const data = await parseJsonBody(res)
      if (!res.ok) {
        toastHttpError(res, data, "Could not load sub-categories")
        setSubRows([])
        return
      }
      setSubRows(Array.isArray(data) ? (data as AuditSubCategoryTypeRow[]) : [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load sub-categories")
      setSubRows([])
    } finally {
      setLoadingSubs(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    if (rows.length === 0) {
      setSubParentId(null)
      setSubRows([])
      return
    }
    setSubParentId((prev) => {
      if (prev !== null && rows.some((r) => r.id === prev)) return prev
      return rows[0].id
    })
  }, [rows])

  React.useEffect(() => {
    if (subParentId === null) return
    void loadSubs(subParentId)
  }, [subParentId, loadSubs])

  const openCreate = () => {
    setNewName("")
    setNewDescription("")
    setNewSort("")
    setCreateOpen(true)
  }

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) {
      toast.error("Name is required.")
      return
    }
    setCreating(true)
    try {
      const sortOrder = newSort.trim() === "" ? undefined : Number(newSort)
      const res = await fetch("/api/audit-category-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: newDescription.trim() || null,
          ...(Number.isFinite(sortOrder) ? { sortOrder } : {}),
        }),
      })
      const payload = await parseJsonBody(res)
      if (!res.ok) {
        toastHttpError(res, payload, "Could not create")
        return
      }
      toast.success("Category added.")
      setCreateOpen(false)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error")
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (r: AuditCategoryTypeRow) => {
    setEditRow(r)
    setEditName(r.name)
    setEditDescription(r.description ?? "")
    setEditSort(String(r.sortOrder))
    setEditActive(r.isActive)
  }

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editRow) return
    const name = editName.trim()
    if (!name) {
      toast.error("Name is required.")
      return
    }
    setSavingEdit(true)
    try {
      const sortOrder = Number(editSort)
      const res = await fetch(`/api/audit-category-types/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: editDescription.trim() || null,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : editRow.sortOrder,
          isActive: editActive,
        }),
      })
      const payload = await parseJsonBody(res)
      if (!res.ok) {
        toastHttpError(res, payload, "Could not save")
        return
      }
      toast.success("Saved.")
      setEditRow(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error")
    } finally {
      setSavingEdit(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/audit-category-types/${deleteTarget.id}`, {
        method: "DELETE",
      })
      const payload = await parseJsonBody(res)
      if (!res.ok) {
        toastHttpError(res, payload, "Could not delete")
        return
      }
      toast.success("Deleted.")
      setDeleteTarget(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error")
    } finally {
      setDeleting(false)
    }
  }

  const openSubCreate = () => {
    setSubNewName("")
    setSubNewSort("")
    setSubCreateOpen(true)
  }

  const submitSubCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (subParentId === null) return
    const name = subNewName.trim()
    if (!name) {
      toast.error("Name is required.")
      return
    }
    setSubCreating(true)
    try {
      const sortOrder = subNewSort.trim() === "" ? undefined : Number(subNewSort)
      const res = await fetch("/api/audit-subcategory-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditCategoryTypeId: subParentId,
          name,
          ...(Number.isFinite(sortOrder) ? { sortOrder } : {}),
        }),
      })
      const payload = await parseJsonBody(res)
      if (!res.ok) {
        toastHttpError(res, payload, "Could not create")
        return
      }
      toast.success("Sub-category added.")
      setSubCreateOpen(false)
      await loadSubs(subParentId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error")
    } finally {
      setSubCreating(false)
    }
  }

  const openSubEdit = (r: AuditSubCategoryTypeRow) => {
    setSubEditRow(r)
    setSubEditName(r.name)
    setSubEditSort(String(r.sortOrder))
    setSubEditActive(r.isActive)
  }

  const submitSubEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subEditRow || subParentId === null) return
    const name = subEditName.trim()
    if (!name) {
      toast.error("Name is required.")
      return
    }
    setSubSavingEdit(true)
    try {
      const sortOrder = Number(subEditSort)
      const res = await fetch(`/api/audit-subcategory-types/${subEditRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : subEditRow.sortOrder,
          isActive: subEditActive,
        }),
      })
      const payload = await parseJsonBody(res)
      if (!res.ok) {
        toastHttpError(res, payload, "Could not save")
        return
      }
      toast.success("Saved.")
      setSubEditRow(null)
      await loadSubs(subParentId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error")
    } finally {
      setSubSavingEdit(false)
    }
  }

  const confirmSubDelete = async () => {
    if (!subDeleteTarget || subParentId === null) return
    setSubDeleting(true)
    try {
      const res = await fetch(`/api/audit-subcategory-types/${subDeleteTarget.id}`, {
        method: "DELETE",
      })
      const payload = await parseJsonBody(res)
      if (!res.ok) {
        toastHttpError(res, payload, "Could not delete")
        return
      }
      toast.success("Deleted.")
      setSubDeleteTarget(null)
      await loadSubs(subParentId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error")
    } finally {
      setSubDeleting(false)
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Audit Settings</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Manage audit categories and sub-categories for Compliance → Audit Plan. Inactive items
          are hidden when creating new audits; existing records keep their labels.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">1. Category</h2>
          <p className="text-muted-foreground text-sm">
            Top-level audit types (e.g. Internal, Supplier).
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" size="sm" onClick={openCreate}>
            <IconPlus className="mr-1.5 size-4" />
            Add category
          </Button>
        </div>

        <div className="bg-card overflow-x-auto rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="whitespace-nowrap">Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="whitespace-nowrap">Active</TableHead>
                <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                    No categories yet. Defaults are created on first open.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.sortOrder}</TableCell>
                    <TableCell className="max-w-[min(420px,50vw)]">
                      <div className="font-medium">{r.name}</div>
                      {r.description && (
                        <div className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                          {r.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{r.isActive ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Edit"
                          onClick={() => openEdit(r)}
                        >
                          <IconPencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(r)}
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
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">2. Sub-category</h2>
          <p className="text-muted-foreground text-sm">
            Options under each category (e.g. lines under Internal). They appear in Create Audit
            after you pick a category.{" "}
            <span className="text-foreground/80">
              Sort order is the display sequence in those lists (lower numbers first; same number
              ties by id).
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Label htmlFor={`sub-parent-${subUid}`}>Parent category</Label>
            <Select
              value={subParentId === null ? undefined : String(subParentId)}
              onValueChange={(v) => setSubParentId(Number(v))}
              disabled={rows.length === 0 || loading}
            >
              <SelectTrigger
                id={`sub-parent-${subUid}`}
                className="w-full min-w-[240px] sm:w-[min(100%,420px)]"
              >
                <SelectValue placeholder="Select a category…" />
              </SelectTrigger>
              <SelectContent>
                {rows.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            className="shrink-0 self-start sm:self-auto"
            onClick={openSubCreate}
            disabled={subParentId === null || loading}
          >
            <IconPlus className="mr-1.5 size-4" />
            Add sub-category
          </Button>
        </div>

        <div className="bg-card overflow-x-auto rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="whitespace-nowrap">Sort order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="whitespace-nowrap">Active</TableHead>
                <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subParentId === null || rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                    Add a category in the section above first.
                  </TableCell>
                </TableRow>
              ) : loadingSubs ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : subRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                    No sub-categories for this category yet.
                  </TableCell>
                </TableRow>
              ) : (
                subRows.map((sr) => (
                  <TableRow key={sr.id}>
                    <TableCell className="font-mono text-sm">{sr.sortOrder}</TableCell>
                    <TableCell className="font-medium">{sr.name}</TableCell>
                    <TableCell>{sr.isActive ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Edit"
                          onClick={() => openSubEdit(sr)}
                        >
                          <IconPencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setSubDeleteTarget(sr)}
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
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add audit category</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCreate} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor={`new-name-${uid}`}>Name</Label>
              <Input
                id={`new-name-${uid}`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Internal"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`new-desc-${uid}`}>Description (optional)</Label>
              <Textarea
                id={`new-desc-${uid}`}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="min-h-[80px]"
                placeholder="Notes for administrators…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`new-sort-${uid}`}>Sort order (optional)</Label>
              <Input
                id={`new-sort-${uid}`}
                value={newSort}
                onChange={(e) => setNewSort(e.target.value)}
                placeholder="Leave empty for auto"
                inputMode="numeric"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creating}>
                {creating ? "Adding…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit category</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor={`ed-name-${uid}`}>Name</Label>
              <Input
                id={`ed-name-${uid}`}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`ed-desc-${uid}`}>Description</Label>
              <Textarea
                id={`ed-desc-${uid}`}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`ed-sort-${uid}`}>Sort order</Label>
              <Input
                id={`ed-sort-${uid}`}
                value={editSort}
                onChange={(e) => setEditSort(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor={`ed-act-${uid}`}>Active</Label>
                <p className="text-muted-foreground text-xs">
                  Inactive categories are hidden in new audit forms.
                </p>
              </div>
              <Switch
                id={`ed-act-${uid}`}
                checked={editActive}
                onCheckedChange={setEditActive}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete category?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {deleteTarget
              ? `Remove “${deleteTarget.name}”? This is only allowed if no audit plan entry uses it.`
              : ""}
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={subCreateOpen} onOpenChange={setSubCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add sub-category</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitSubCreate} className="flex flex-col gap-4">
            <p className="text-muted-foreground text-sm">
              For:{" "}
              <span className="text-foreground font-medium">
                {subParentId !== null
                  ? rows.find((x) => x.id === subParentId)?.name ?? "—"
                  : "—"}
              </span>
            </p>
            <div className="space-y-2">
              <Label htmlFor={`sub-new-name-${subUid}`}>Name</Label>
              <Input
                id={`sub-new-name-${subUid}`}
                value={subNewName}
                onChange={(e) => setSubNewName(e.target.value)}
                placeholder="e.g. Process audit"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`sub-new-sort-${subUid}`}>Sort order (optional)</Label>
              <Input
                id={`sub-new-sort-${subUid}`}
                value={subNewSort}
                onChange={(e) => setSubNewSort(e.target.value)}
                placeholder="Leave empty for auto"
                inputMode="numeric"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={subCreating || subParentId === null}>
                {subCreating ? "Adding…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!subEditRow} onOpenChange={(o) => !o && setSubEditRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit sub-category</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitSubEdit} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor={`sub-ed-name-${subUid}`}>Name</Label>
              <Input
                id={`sub-ed-name-${subUid}`}
                value={subEditName}
                onChange={(e) => setSubEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`sub-ed-sort-${subUid}`}>Sort order</Label>
              <Input
                id={`sub-ed-sort-${subUid}`}
                value={subEditSort}
                onChange={(e) => setSubEditSort(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor={`sub-ed-act-${subUid}`}>Active</Label>
                <p className="text-muted-foreground text-xs">
                  Inactive sub-categories are hidden in new audit forms.
                </p>
              </div>
              <Switch
                id={`sub-ed-act-${subUid}`}
                checked={subEditActive}
                onCheckedChange={setSubEditActive}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={subSavingEdit}>
                {subSavingEdit ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!subDeleteTarget} onOpenChange={(o) => !o && setSubDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete sub-category?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {subDeleteTarget
              ? `Remove “${subDeleteTarget.name}”? If it is used by audit plan entries, delete will be blocked—deactivate it instead.`
              : ""}
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setSubDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={subDeleting}
              onClick={confirmSubDelete}
            >
              {subDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
