"use client"

import * as React from "react"
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type DeptRow = {
  id: number
  key: string
  label: string
  paperPrefix: string
  includeYearInPaperNo: boolean
  sortOrder: number
  isActive: boolean
}

export function ConfigOutgoingCorrespondenceDeptsClient() {
  const [rows, setRows] = React.useState<DeptRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [banner, setBanner] = React.useState<{
    type: "ok" | "err"
    text: string
  } | null>(null)

  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editingKey, setEditingKey] = React.useState<string | null>(null)
  const [formKey, setFormKey] = React.useState("")
  const [formLabel, setFormLabel] = React.useState("")
  const [formPrefix, setFormPrefix] = React.useState("")
  const [formSort, setFormSort] = React.useState(0)
  const [formActive, setFormActive] = React.useState(true)
  const [formYearInNo, setFormYearInNo] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const [deleteTarget, setDeleteTarget] = React.useState<DeptRow | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/outgoing-correspondence-dept-configs", {
        cache: "no-store",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          (data as { error?: string } | null)?.error || "Load failed"
        )
      }
      setRows(Array.isArray(data) ? (data as DeptRow[]) : [])
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not load departments",
      })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner(null), 5000)
    return () => window.clearTimeout(t)
  }, [banner])

  const openCreate = () => {
    setEditingKey(null)
    setFormKey("")
    setFormLabel("")
    setFormPrefix("")
    setFormSort(rows.length)
    setFormActive(true)
    setFormYearInNo(false)
    setEditorOpen(true)
  }

  const openEdit = (r: DeptRow) => {
    setEditingKey(r.key)
    setFormKey(r.key)
    setFormLabel(r.label)
    setFormPrefix(r.paperPrefix)
    setFormSort(r.sortOrder)
    setFormActive(r.isActive)
    setFormYearInNo(!!r.includeYearInPaperNo)
    setEditorOpen(true)
  }

  const saveEditor = async () => {
    setSaving(true)
    try {
      if (editingKey) {
        const res = await fetch(
          `/api/outgoing-correspondence-dept-configs/${encodeURIComponent(editingKey)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: formLabel.trim(),
              paperPrefix: formPrefix.trim(),
              sortOrder: formSort,
              isActive: formActive,
              includeYearInPaperNo: formYearInNo,
            }),
          }
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || "Could not save")
        }
      } else {
        const res = await fetch("/api/outgoing-correspondence-dept-configs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: formKey.trim().toLowerCase(),
            label: formLabel.trim(),
            paperPrefix: formPrefix.trim(),
            sortOrder: formSort,
            isActive: formActive,
            includeYearInPaperNo: formYearInNo,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || "Could not create")
        }
      }
      setBanner({ type: "ok", text: editingKey ? "Department updated." : "Department added." })
      setEditorOpen(false)
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Save failed",
      })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/outgoing-correspondence-dept-configs/${encodeURIComponent(deleteTarget.key)}`,
        { method: "DELETE" }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Could not delete")
      }
      setBanner({ type: "ok", text: "Department removed." })
      setDeleteTarget(null)
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Delete failed",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-2xl font-bold tracking-tight">Outgoing correspondence · Departments</h2>
          <p className="text-muted-foreground text-sm max-w-3xl">
            <strong>Prefix</strong> is only the fixed part (e.g. <code className="text-xs">BON-CMM</code>), not
            the year or sequence. Turn on <strong>Year in number</strong> for formats like{" "}
            <code className="text-xs">BON-CMM-2026-001</code> (year = Istanbul calendar). Otherwise numbers
            are <code className="text-xs">BON-CMM-001</code>. Deleted numbers are reused first.
          </p>
        </div>
        <Button type="button" className="shrink-0 gap-2" variant="outline" onClick={openCreate}>
          <IconPlus className="size-4" />
          Add department
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          {banner && (
            <div
              role="status"
              className={
                banner.type === "ok"
                  ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                  : "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              }
            >
              {banner.text}
            </div>
          )}

          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No departments yet. Add one to send outgoing mail.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Year in no.</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell>{r.sortOrder}</TableCell>
                      <TableCell className="font-mono text-sm">{r.key}</TableCell>
                      <TableCell>{r.label}</TableCell>
                      <TableCell className="font-mono text-sm">{r.paperPrefix}</TableCell>
                      <TableCell>{r.includeYearInPaperNo ? "Yes" : "No"}</TableCell>
                      <TableCell>{r.isActive ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => openEdit(r)}
                          >
                            <IconPencil className="size-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive gap-1"
                            onClick={() => setDeleteTarget(r)}
                          >
                            <IconTrash className="size-4" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingKey ? "Edit department" : "New department"}</DialogTitle>
            <DialogDescription>
              Key = stable id (lowercase). Prefix = fixed root only (e.g. BON-CMM). With &quot;Year in
              number&quot;, the system adds the Istanbul calendar year and then 001, 002…
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editingKey && (
              <div className="space-y-2">
                <Label htmlFor="cfg-key">Key</Label>
                <Input
                  id="cfg-key"
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  placeholder="e.g. sms"
                  disabled={saving}
                  autoComplete="off"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cfg-label">Label</Label>
              <Input
                id="cfg-label"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="Shown in lists"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-prefix">Correspondence prefix</Label>
              <Input
                id="cfg-prefix"
                value={formPrefix}
                onChange={(e) => setFormPrefix(e.target.value)}
                placeholder="e.g. BON-SMS"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-sort">Sort order</Label>
              <Input
                id="cfg-sort"
                type="number"
                value={formSort}
                onChange={(e) => setFormSort(Number.parseInt(e.target.value, 10) || 0)}
                disabled={saving}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
              <div className="space-y-0.5">
                <Label htmlFor="cfg-year">Year in number (…-2026-001)</Label>
                <p className="text-muted-foreground text-xs">
                  Uses Europe/Istanbul calendar year between prefix and sequence.
                </p>
              </div>
              <Switch
                id="cfg-year"
                checked={formYearInNo}
                onCheckedChange={setFormYearInNo}
                disabled={saving}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
              <Label htmlFor="cfg-active">Active (available when composing)</Label>
              <Switch
                id="cfg-active"
                checked={formActive}
                onCheckedChange={setFormActive}
                disabled={saving}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                saving ||
                !formLabel.trim() ||
                !formPrefix.trim() ||
                (!editingKey && !formKey.trim())
              }
              onClick={() => void saveEditor()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete department?</DialogTitle>
            <DialogDescription>
              Only allowed if no outgoing correspondence uses this department. Released numbers for
              this key are removed with the department.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <p className="text-sm font-medium">
              {deleteTarget.label} ({deleteTarget.key})
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
