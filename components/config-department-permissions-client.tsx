"use client"

import * as React from "react"
import { IconDeviceFloppy, IconInfoCircle, IconPlus } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { normalizeDepartmentKey } from "@/lib/department-access"
import type { DepartmentPermissionCatalogEntry } from "@/lib/department-permission-keys"
import { legacyDepartmentPermission } from "@/lib/department-permissions-legacy"
import { isValidCustomManualDepartment } from "@/lib/organization-departments"

type Mode = "inherit" | "allow" | "deny"

type MatrixCell = {
  permissionKey: string
  mode: Mode
  effective: boolean
}

type MatrixRow = {
  departmentKey: string
  displayName: string
  cells: MatrixCell[]
}

type MatrixPayload = {
  catalog: DepartmentPermissionCatalogEntry[]
  rows: MatrixRow[]
}

function cloneMatrix(rows: MatrixRow[]): MatrixRow[] {
  return rows.map((r) => ({
    ...r,
    cells: r.cells.map((c) => ({ ...c })),
  }))
}

export function ConfigDepartmentPermissionsClient() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [catalog, setCatalog] = React.useState<DepartmentPermissionCatalogEntry[]>([])
  const [baseline, setBaseline] = React.useState<MatrixRow[]>([])
  const [working, setWorking] = React.useState<MatrixRow[]>([])
  const [newDept, setNewDept] = React.useState("")
  const [addingDept, setAddingDept] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/department-permissions", { cache: "no-store" })
      const raw = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(
          typeof raw?.error === "string" ? raw.error : "Matris yüklenemedi."
        )
        return
      }
      const data = raw as MatrixPayload
      if (!Array.isArray(data.catalog) || !Array.isArray(data.rows)) {
        toast.error("Geçersiz yanıt.")
        return
      }
      setCatalog(data.catalog)
      const rows = data.rows as MatrixRow[]
      setBaseline(cloneMatrix(rows))
      setWorking(cloneMatrix(rows))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const setCellMode = React.useCallback(
    (departmentKey: string, permissionKey: string, mode: Mode) => {
      setWorking((prev) =>
        prev.map((row) => {
          if (row.departmentKey !== departmentKey) return row
          return {
            ...row,
            cells: row.cells.map((cell) => {
              if (cell.permissionKey !== permissionKey) return cell
              return {
                ...cell,
                mode,
                effective:
                  mode === "inherit"
                    ? legacyDepartmentPermission(permissionKey, row.displayName)
                    : mode === "allow",
              }
            }),
          }
        })
      )
    },
    []
  )

  const addDepartmentRow = React.useCallback(async () => {
    const raw = newDept.trim()
    if (!isValidCustomManualDepartment(raw)) {
      toast.error("Geçersiz departman adı (1–100 karakter).")
      return
    }
    const departmentKey = normalizeDepartmentKey(raw)
    if (!departmentKey) {
      toast.error("Departman anahtarı üretilemedi.")
      return
    }
    if (working.some((r) => r.departmentKey === departmentKey)) {
      toast.error("Bu departman zaten listede.")
      return
    }
    setAddingDept(true)
    try {
      const res = await fetch("/api/organization-departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: raw }),
      })
      const rawJson = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(
          typeof rawJson?.error === "string"
            ? rawJson.error
            : "Departman eklenemedi."
        )
        return
      }
      setNewDept("")
      toast.success("Departman eklendi; matris yenilendi.")
      await load()
    } finally {
      setAddingDept(false)
    }
  }, [load, newDept, working])

  const buildDiffUpdates = React.useCallback(() => {
    const updates: { departmentKey: string; permissionKey: string; mode: Mode }[] =
      []
    for (const row of working) {
      const base = baseline.find((b) => b.departmentKey === row.departmentKey)
      if (!base) {
        for (const cell of row.cells) {
          if (cell.mode !== "inherit") {
            updates.push({
              departmentKey: row.departmentKey,
              permissionKey: cell.permissionKey,
              mode: cell.mode,
            })
          }
        }
        continue
      }
      for (const cell of row.cells) {
        const bc = base.cells.find((c) => c.permissionKey === cell.permissionKey)
        const prevMode = bc?.mode ?? "inherit"
        if (cell.mode !== prevMode) {
          updates.push({
            departmentKey: row.departmentKey,
            permissionKey: cell.permissionKey,
            mode: cell.mode,
          })
        }
      }
    }
    for (const base of baseline) {
      if (!working.some((w) => w.departmentKey === base.departmentKey)) {
        for (const cell of base.cells) {
          if (cell.mode !== "inherit") {
            updates.push({
              departmentKey: base.departmentKey,
              permissionKey: cell.permissionKey,
              mode: "inherit",
            })
          }
        }
      }
    }
    return updates
  }, [baseline, working])

  const isDirty = React.useMemo(() => {
    for (const row of working) {
      const base = baseline.find((b) => b.departmentKey === row.departmentKey)
      if (!base) return true
      for (const cell of row.cells) {
        const bc = base.cells.find((c) => c.permissionKey === cell.permissionKey)
        if ((bc?.mode ?? "inherit") !== cell.mode) return true
      }
    }
    return false
  }, [working, baseline])

  const save = React.useCallback(async () => {
    const updates = buildDiffUpdates()
    if (updates.length === 0) {
      toast.message("Kaydedilecek değişiklik yok.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/department-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })
      const raw = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof raw?.error === "string" ? raw.error : "Kayıt başarısız.")
        return
      }
      const data = raw as MatrixPayload
      if (Array.isArray(data.rows)) {
        setBaseline(cloneMatrix(data.rows))
        setWorking(cloneMatrix(data.rows))
      }
      toast.success("Yetkiler güncellendi.")
    } finally {
      setSaving(false)
    }
  }, [buildDiffUpdates])

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm">Yetki matrisi yükleniyor…</p>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex max-w-[1200px] flex-col gap-6">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold">
              Departman bazlı izinler
            </CardTitle>
            <CardDescription>
              <span className="inline-flex items-start gap-2">
                <IconInfoCircle className="mt-0.5 size-4 shrink-0" />
                <span>
                  <strong>Varsayılan (kod)</strong> satır yoksa uygulanan kurallardır (
                  örn. Quality + Admin için Compliance Monitoring).{" "}
                  <strong>Açık / Kapalı</strong> seçildiğinde veritabanında kesin kayıt
                  oluşur.
                </span>
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Tüm yapılandırma menüsüne erişimi kapatırsanız bu sayfayı da açamazsınız;
              en az bir departmanda &quot;Configurations&quot; iznini açık tutun veya tüm
              hücreleri varsayılan bırakın.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1 space-y-2">
                <Label htmlFor="new-dept-perm">Tabloya departman ekle</Label>
                <Input
                  id="new-dept-perm"
                  placeholder="Örn. Flight Operations"
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void addDepartmentRow()}
                disabled={addingDept}
              >
                <IconPlus className="size-4" />
                {addingDept ? "Ekleniyor…" : "Departman oluştur ve ekle"}
              </Button>
              <Button type="button" onClick={save} disabled={saving}>
                <IconDeviceFloppy className="size-4" />
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sticky save bar — appears when there are unsaved changes */}
        {isDirty && (
          <div className="sticky bottom-4 z-50 flex items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 shadow-lg dark:border-amber-700 dark:bg-amber-950/40">
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
              ⚠ Kaydedilmemiş değişiklikler var
            </span>
            <Button type="button" onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6">
              <IconDeviceFloppy className="size-4" />
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Departman</TableHead>
                {catalog.map((c) => (
                  <TableHead key={c.key} className="min-w-[140px] text-center">
                    <span className="inline-flex items-center justify-center gap-1">
                      {c.label}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={`${c.label} açıklaması`}
                          >
                            <IconInfoCircle className="size-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-left">
                          {c.description}
                        </TooltipContent>
                      </Tooltip>
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {working.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={1 + catalog.length}
                    className="text-muted-foreground text-center text-sm"
                  >
                    Kayıtlı departman yok. Önce{" "}
                    <a href="/configurations/departments" className="underline">
                      Departmanlar
                    </a>{" "}
                    sayfasından ekleyin veya yukarıdan manuel satır ekleyin.
                  </TableCell>
                </TableRow>
              ) : (
                working.map((row) => (
                  <TableRow key={row.departmentKey}>
                    <TableCell className="align-top font-medium">
                      {row.displayName}
                    </TableCell>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.permissionKey} className="align-top">
                        <div className="flex flex-col items-stretch gap-1.5">
                          <Select
                            value={cell.mode}
                            onValueChange={(v) =>
                              setCellMode(row.departmentKey, cell.permissionKey, v as Mode)
                            }
                          >
                            <SelectTrigger className="h-9 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inherit">Varsayılan (kod)</SelectItem>
                              <SelectItem value="allow">Açık</SelectItem>
                              <SelectItem value="deny">Kapalı</SelectItem>
                            </SelectContent>
                          </Select>
                          <span
                            className={
                              cell.effective
                                ? "text-center text-[11px] text-emerald-700"
                                : "text-center text-[11px] text-muted-foreground"
                            }
                          >
                            Etkili: {cell.effective ? "Evet" : "Hayır"}
                          </span>
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  )
}
