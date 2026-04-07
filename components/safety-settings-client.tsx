"use client"

import * as React from "react"
import { IconDotsVertical, IconPlus, IconTrash } from "@tabler/icons-react"

import { formatYmdIstanbul } from "@/lib/date-format"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type SafetyObjectiveRow = {
  id: number
  sortOrder: number
  text: string
  insertionDate: string
}

type CustomReportTypeRow = {
  id: number
  sortOrder: number
  name: string
}

export function SafetySettingsClient() {
  const [objectives, setObjectives] = React.useState<SafetyObjectiveRow[]>([])
  const [reportTypes, setReportTypes] = React.useState<CustomReportTypeRow[]>([])
  const [loadingObj, setLoadingObj] = React.useState(true)
  const [loadingRt, setLoadingRt] = React.useState(true)
  const [banner, setBanner] = React.useState<{ type: "ok" | "err"; text: string } | null>(null)

  const [objCreateOpen, setObjCreateOpen] = React.useState(false)
  const [objNewText, setObjNewText] = React.useState("")
  const [objCreating, setObjCreating] = React.useState(false)

  const [objEdit, setObjEdit] = React.useState<SafetyObjectiveRow | null>(null)
  const [objEditText, setObjEditText] = React.useState("")
  const [objSaving, setObjSaving] = React.useState(false)

  const [objDelete, setObjDelete] = React.useState<SafetyObjectiveRow | null>(null)
  const [objDeleting, setObjDeleting] = React.useState(false)

  const [rtCreateOpen, setRtCreateOpen] = React.useState(false)
  const [rtNewName, setRtNewName] = React.useState("")
  const [rtCreating, setRtCreating] = React.useState(false)

  const [rtEdit, setRtEdit] = React.useState<CustomReportTypeRow | null>(null)
  const [rtEditName, setRtEditName] = React.useState("")
  const [rtSaving, setRtSaving] = React.useState(false)

  const [rtDelete, setRtDelete] = React.useState<CustomReportTypeRow | null>(null)
  const [rtDeleting, setRtDeleting] = React.useState(false)

  React.useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner(null), 4500)
    return () => window.clearTimeout(t)
  }, [banner])

  const loadObjectives = React.useCallback(async () => {
    setLoadingObj(true)
    try {
      const res = await fetch("/api/safety-objectives", { cache: "no-store" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Objectives could not be loaded")
      }
      const data = (await res.json()) as SafetyObjectiveRow[]
      setObjectives(Array.isArray(data) ? data : [])
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Objectives could not be loaded",
      })
      setObjectives([])
    } finally {
      setLoadingObj(false)
    }
  }, [])

  const loadReportTypes = React.useCallback(async () => {
    setLoadingRt(true)
    try {
      const res = await fetch("/api/custom-report-types", { cache: "no-store" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Report types could not be loaded")
      }
      const data = (await res.json()) as CustomReportTypeRow[]
      setReportTypes(Array.isArray(data) ? data : [])
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Report types could not be loaded",
      })
      setReportTypes([])
    } finally {
      setLoadingRt(false)
    }
  }, [])

  React.useEffect(() => {
    void loadObjectives()
    void loadReportTypes()
  }, [loadObjectives, loadReportTypes])

  async function submitObjectiveCreate() {
    const text = objNewText.trim()
    if (!text) {
      setBanner({ type: "err", text: "Objective text is required." })
      return
    }
    setObjCreating(true)
    try {
      const res = await fetch("/api/safety-objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Could not create")
      }
      setObjCreateOpen(false)
      setObjNewText("")
      setBanner({ type: "ok", text: "Objective added." })
      await loadObjectives()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not create",
      })
    } finally {
      setObjCreating(false)
    }
  }

  async function submitObjectiveEdit() {
    if (!objEdit) return
    const text = objEditText.trim()
    if (!text) {
      setBanner({ type: "err", text: "Objective text is required." })
      return
    }
    setObjSaving(true)
    try {
      const res = await fetch(`/api/safety-objectives/${objEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Could not save")
      }
      setObjEdit(null)
      setBanner({ type: "ok", text: "Objective updated." })
      await loadObjectives()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not save",
      })
    } finally {
      setObjSaving(false)
    }
  }

  async function submitObjectiveDelete() {
    if (!objDelete) return
    setObjDeleting(true)
    try {
      const res = await fetch(`/api/safety-objectives/${objDelete.id}`, {
        method: "DELETE",
      })
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Could not delete")
      }
      setObjDelete(null)
      setBanner({ type: "ok", text: "Objective deleted." })
      await loadObjectives()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not delete",
      })
    } finally {
      setObjDeleting(false)
    }
  }

  async function submitRtCreate() {
    const name = rtNewName.trim()
    if (!name) {
      setBanner({ type: "err", text: "Name is required." })
      return
    }
    setRtCreating(true)
    try {
      const res = await fetch("/api/custom-report-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Could not create")
      }
      setRtCreateOpen(false)
      setRtNewName("")
      setBanner({ type: "ok", text: "Report type added." })
      await loadReportTypes()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not create",
      })
    } finally {
      setRtCreating(false)
    }
  }

  async function submitRtEdit() {
    if (!rtEdit) return
    const name = rtEditName.trim()
    if (!name) {
      setBanner({ type: "err", text: "Name is required." })
      return
    }
    setRtSaving(true)
    try {
      const res = await fetch(`/api/custom-report-types/${rtEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Could not save")
      }
      setRtEdit(null)
      setBanner({ type: "ok", text: "Report type updated." })
      await loadReportTypes()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not save",
      })
    } finally {
      setRtSaving(false)
    }
  }

  async function submitRtDelete() {
    if (!rtDelete) return
    setRtDeleting(true)
    try {
      const res = await fetch(`/api/custom-report-types/${rtDelete.id}`, {
        method: "DELETE",
      })
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Could not delete")
      }
      setRtDelete(null)
      setBanner({ type: "ok", text: "Report type deleted." })
      await loadReportTypes()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not delete",
      })
    } finally {
      setRtDeleting(false)
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-8 pb-8">
      {banner && (
        <div
          role="status"
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            banner.type === "ok" ? "ss-flash-ok" : "ss-flash-err"
          )}
        >
          {banner.text}
        </div>
      )}

      <Card className="ss-panel gap-0 border-0 bg-transparent py-0 shadow-none">
        <CardHeader className="ss-panel-header !grid-cols-1 !gap-0 space-y-0 border-b px-6 py-5">
          <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <CardTitle className="ss-panel-title min-w-0 flex-1 text-left text-lg leading-snug">
              Objective settings
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full shrink-0 gap-1.5 whitespace-nowrap border-border bg-white font-semibold shadow-xs hover:bg-neutral-50 sm:w-auto sm:self-center dark:bg-card dark:hover:bg-muted/50"
              onClick={() => {
                setObjNewText("")
                setObjCreateOpen(true)
              }}
            >
              <IconPlus className="size-4 shrink-0" />
              Objective
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-5">
          {loadingObj ? (
            <div className="space-y-2">
              <Skeleton className="ss-skeleton h-10 w-full animate-none" />
              <Skeleton className="ss-skeleton h-10 w-full animate-none" />
            </div>
          ) : (
            <div className="ss-table-wrap">
              <Table className="ss-table">
                <TableHeader>
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead className="w-16">Order</TableHead>
                    <TableHead>Objective</TableHead>
                    <TableHead className="w-36">Insertion date</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {objectives.length === 0 ? (
                    <TableRow className="ss-row-a hover:bg-transparent">
                      <TableCell
                        colSpan={4}
                        className="text-muted-foreground py-12 pl-6 text-left text-sm leading-relaxed"
                      >
                        No objectives yet. Add one with the button above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    objectives.map((row, i) => (
                      <TableRow
                        key={row.id}
                        className={cn(i % 2 === 0 ? "ss-row-a" : "ss-row-b")}
                      >
                        <TableCell className="align-top">
                          <span className="ss-order-pill">{row.sortOrder}</span>
                        </TableCell>
                        <TableCell className="max-w-xl whitespace-normal align-top text-[0.9375rem] leading-relaxed">
                          {row.text}
                        </TableCell>
                        <TableCell className="ss-date-cell align-top">
                          {formatYmdIstanbul(row.insertionDate)}
                        </TableCell>
                        <TableCell className="text-right align-top">
                          <div className="flex items-center justify-end gap-0.5">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="ss-action-btn size-9 text-muted-foreground"
                                  aria-label="Objective actions"
                                >
                                  <IconDotsVertical className="size-5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setObjEdit(row)
                                    setObjEditText(row.text)
                                  }}
                                >
                                  Edit
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="ss-action-btn size-9 text-destructive hover:text-destructive"
                              aria-label="Delete objective"
                              onClick={() => setObjDelete(row)}
                            >
                              <IconTrash className="size-5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="ss-panel gap-0 border-0 bg-transparent py-0 shadow-none">
        <CardHeader className="ss-panel-header !grid-cols-1 !gap-0 space-y-0 border-b px-6 py-5">
          <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <CardTitle className="ss-panel-title min-w-0 flex-1 text-left text-lg leading-snug">
              Custom report types
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full shrink-0 gap-1.5 whitespace-nowrap border-border bg-white font-semibold shadow-xs hover:bg-neutral-50 sm:w-auto sm:self-center dark:bg-card dark:hover:bg-muted/50"
              onClick={() => {
                setRtNewName("")
                setRtCreateOpen(true)
              }}
            >
              <IconPlus className="size-4 shrink-0" />
              Custom report type
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-5">
          {loadingRt ? (
            <div className="space-y-2">
              <Skeleton className="ss-skeleton h-10 w-full animate-none" />
              <Skeleton className="ss-skeleton h-10 w-full animate-none" />
            </div>
          ) : (
            <div className="ss-table-wrap">
              <Table className="ss-table">
                <TableHeader>
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead className="w-16">Order</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportTypes.length === 0 ? (
                    <TableRow className="ss-row-a hover:bg-transparent">
                      <TableCell
                        colSpan={3}
                        className="text-muted-foreground py-12 pl-6 text-left text-sm leading-relaxed"
                      >
                        No custom report types yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportTypes.map((row, i) => (
                      <TableRow
                        key={row.id}
                        className={cn(i % 2 === 0 ? "ss-row-a" : "ss-row-b")}
                      >
                        <TableCell className="align-top">
                          <span className="ss-order-pill">{row.sortOrder}</span>
                        </TableCell>
                        <TableCell className="align-top text-[0.9375rem] font-medium">
                          {row.name}
                        </TableCell>
                        <TableCell className="text-right align-top">
                          <div className="flex items-center justify-end gap-0.5">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="ss-action-btn size-9 text-muted-foreground"
                                  aria-label="Report type actions"
                                >
                                  <IconDotsVertical className="size-5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setRtEdit(row)
                                    setRtEditName(row.name)
                                  }}
                                >
                                  Edit
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="ss-action-btn size-9 text-destructive hover:text-destructive"
                              aria-label="Delete report type"
                              onClick={() => setRtDelete(row)}
                            >
                              <IconTrash className="size-5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={objCreateOpen} onOpenChange={setObjCreateOpen}>
        <DialogContent className="ss-safety-dialog sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New objective</DialogTitle>
            <DialogDescription>
              Order and insertion date are set automatically when you save.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="obj-new-text">Objective</Label>
            <Textarea
              id="obj-new-text"
              value={objNewText}
              onChange={(e) => setObjNewText(e.target.value)}
              rows={5}
              placeholder="Describe the objective…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setObjCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={objCreating} onClick={() => void submitObjectiveCreate()}>
              {objCreating ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!objEdit}
        onOpenChange={(o) => {
          if (!o) setObjEdit(null)
        }}
      >
        <DialogContent className="ss-safety-dialog sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit objective</DialogTitle>
            <DialogDescription>Update the objective text.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="obj-edit-text">Objective</Label>
            <Textarea
              id="obj-edit-text"
              value={objEditText}
              onChange={(e) => setObjEditText(e.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setObjEdit(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={objSaving} onClick={() => void submitObjectiveEdit()}>
              {objSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!objDelete}
        onOpenChange={(o) => {
          if (!o) setObjDelete(null)
        }}
      >
        <DialogContent className="ss-safety-dialog">
          <DialogHeader>
            <DialogTitle>Delete objective?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setObjDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={objDeleting}
              onClick={() => void submitObjectiveDelete()}
            >
              {objDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rtCreateOpen} onOpenChange={setRtCreateOpen}>
        <DialogContent className="ss-safety-dialog">
          <DialogHeader>
            <DialogTitle>New custom report type</DialogTitle>
            <DialogDescription>Order is assigned automatically.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="rt-new-name">Name</Label>
            <Input
              id="rt-new-name"
              value={rtNewName}
              onChange={(e) => setRtNewName(e.target.value)}
              placeholder="e.g. Near miss"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRtCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={rtCreating} onClick={() => void submitRtCreate()}>
              {rtCreating ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rtEdit}
        onOpenChange={(o) => {
          if (!o) setRtEdit(null)
        }}
      >
        <DialogContent className="ss-safety-dialog">
          <DialogHeader>
            <DialogTitle>Edit report type</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="rt-edit-name">Name</Label>
            <Input
              id="rt-edit-name"
              value={rtEditName}
              onChange={(e) => setRtEditName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRtEdit(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={rtSaving} onClick={() => void submitRtEdit()}>
              {rtSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rtDelete}
        onOpenChange={(o) => {
          if (!o) setRtDelete(null)
        }}
      >
        <DialogContent className="ss-safety-dialog">
          <DialogHeader>
            <DialogTitle>Delete report type?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRtDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rtDeleting}
              onClick={() => void submitRtDelete()}
            >
              {rtDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
