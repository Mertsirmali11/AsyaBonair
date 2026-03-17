"use client"

import * as React from "react"
import {
  IconArrowsSort,
  IconDotsVertical,
  IconPlus,
  IconSortAscending,
  IconSortDescending,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

export type AircraftSettingRow = {
  id: string
  name: string
  code: string
  pilot1: string
  pilot2: string
  date1: string
  date2: string
  departure: string
  arrival: string
}

type SortDirection = "asc" | "desc" | null
type SortField = keyof AircraftSettingRow | null

type ColumnDef = {
  key: keyof AircraftSettingRow
  label: string
  sortable?: boolean
  getValue: (row: AircraftSettingRow) => string
}

type AircraftSettingFormData = Omit<AircraftSettingRow, "id">

type PilotOption = {
  id: number
  fullName: string
}

const columns: ColumnDef[] = [
  { key: "name", label: "Name", sortable: true, getValue: (r) => r.name },
  { key: "code", label: "Code", sortable: true, getValue: (r) => r.code },
  { key: "pilot1", label: "Captain Pilot", sortable: true, getValue: (r) => r.pilot1 },
  { key: "pilot2", label: "F/O", sortable: true, getValue: (r) => r.pilot2 },
  { key: "date1", label: "Date 1", sortable: true, getValue: (r) => r.date1 },
  { key: "date2", label: "Date 2", sortable: true, getValue: (r) => r.date2 },
  { key: "departure", label: "Departure", sortable: true, getValue: (r) => r.departure },
  { key: "arrival", label: "Arrival", sortable: true, getValue: (r) => r.arrival },
]

function normalize(value: string) {
  return value.trim().toLowerCase()
}

const emptyForm: AircraftSettingFormData = {
  name: "",
  code: "",
  pilot1: "",
  pilot2: "",
  date1: "",
  date2: "",
  departure: "",
  arrival: "",
}

export function AircraftSettingsTable({ data }: { data: AircraftSettingRow[] }) {
  const [rows, setRows] = React.useState<AircraftSettingRow[]>(() => data)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [sortField, setSortField] = React.useState<SortField>(null)
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [itemsPerPage, setItemsPerPage] = React.useState(10)

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [isEditMode, setIsEditMode] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [formData, setFormData] = React.useState<AircraftSettingFormData>(emptyForm)
  const [pilots, setPilots] = React.useState<PilotOption[]>([])
  const [pilotsLoading, setPilotsLoading] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    async function loadPilots() {
      setPilotsLoading(true)
      try {
        const res = await fetch("/api/calisanlar")
        if (!res.ok) return
        const json = (await res.json()) as Array<{
          id: number
          isim: string | null
          soyisim: string | null
          departman: string | null
        }>

        const list = json
          .filter((u) => u.departman === "Pilot")
          .map((u) => ({
            id: u.id,
            fullName: `${u.isim ?? ""} ${u.soyisim ?? ""}`.trim(),
          }))
          .filter((u) => u.fullName.length > 0)
          .sort((a, b) => a.fullName.localeCompare(b.fullName))

        if (!cancelled) setPilots(list)
      } finally {
        if (!cancelled) setPilotsLoading(false)
      }
    }

    loadPilots()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredAndSorted = React.useMemo(() => {
    let list = [...rows]

    const q = normalize(searchTerm)
    if (q) {
      list = list.filter((row) =>
        columns.some((col) => normalize(col.getValue(row)).includes(q))
      )
    }

    if (sortField && sortDirection) {
      list.sort((a, b) => {
        const col = columns.find((c) => c.key === sortField)
        const aValue = normalize(col ? col.getValue(a) : String(a[sortField] ?? ""))
        const bValue = normalize(col ? col.getValue(b) : String(b[sortField] ?? ""))

        const cmp = aValue.localeCompare(bValue)
        return sortDirection === "asc" ? cmp : -cmp
      })
    }

    return list
  }, [rows, searchTerm, sortField, sortDirection])

  const totalEntries = filteredAndSorted.length
  const totalPages = Math.max(1, Math.ceil(totalEntries / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, totalEntries)
  const paginatedRows = filteredAndSorted.slice(startIndex, endIndex)

  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  function handleSort(field: SortField) {
    if (!field) return

    if (sortField === field) {
      if (sortDirection === "asc") setSortDirection("desc")
      else if (sortDirection === "desc") {
        setSortField(null)
        setSortDirection(null)
      } else setSortDirection("asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  function getSortIcon(field: SortField) {
    if (!field || sortField !== field) return <IconArrowsSort className="h-4 w-4 text-gray-400" />
    if (sortDirection === "asc") return <IconSortAscending className="h-4 w-4 text-gray-700" />
    return <IconSortDescending className="h-4 w-4 text-gray-700" />
  }

  function updateForm<K extends keyof AircraftSettingFormData>(
    key: K,
    value: AircraftSettingFormData[K]
  ) {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  function openAddDialog() {
    setIsEditMode(false)
    setEditingId(null)
    setFormData(emptyForm)
    setDialogOpen(true)
  }

  function openEditDialog(row: AircraftSettingRow) {
    setIsEditMode(true)
    setEditingId(row.id)
    setFormData({
      name: row.name,
      code: row.code,
      pilot1: row.pilot1,
      pilot2: row.pilot2,
      date1: row.date1,
      date2: row.date2,
      departure: row.departure,
      arrival: row.arrival,
    })
    setDialogOpen(true)
  }

  function handleDelete(row: AircraftSettingRow) {
    const ok = window.confirm(`Delete "${row.name}"?`)
    if (!ok) return
    setRows((prev) => prev.filter((r) => r.id !== row.id))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload: AircraftSettingFormData = {
      name: formData.name.trim(),
      code: formData.code.trim(),
      pilot1: formData.pilot1.trim(),
      pilot2: formData.pilot2.trim(),
      date1: formData.date1,
      date2: formData.date2,
      departure: formData.departure.trim(),
      arrival: formData.arrival.trim(),
    }

    if (!payload.name || !payload.code) return
    if (payload.pilot1 && payload.pilot2 && payload.pilot1 === payload.pilot2) {
      window.alert("Captain Pilot and F/O cannot be the same person.")
      return
    }

    if (isEditMode && editingId) {
      setRows((prev) =>
        prev.map((r) => (r.id === editingId ? { ...r, ...payload } : r))
      )
    } else {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Date.now())
      setRows((prev) => [{ id, ...payload }, ...prev])
    }

    setDialogOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Aircraft List</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-700 hover:bg-slate-800" onClick={openAddDialog}>
              <IconPlus className="mr-2 h-4 w-4" />
              Add Aircraft
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{isEditMode ? "Edit Aircraft" : "Add Aircraft"}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => updateForm("code", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Captain Pilot</Label>
                  <Select
                    value={formData.pilot1}
                    onValueChange={(value) =>
                      updateForm(
                        "pilot1",
                        value === "__none__"
                          ? ""
                          : value === formData.pilot2
                            ? formData.pilot1
                            : value
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={pilotsLoading ? "Loading pilots..." : "Select pilot"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {pilots.map((p) => (
                        <SelectItem
                          key={p.id}
                          value={p.fullName}
                          disabled={p.fullName === formData.pilot2}
                        >
                          {p.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>F/O</Label>
                  <Select
                    value={formData.pilot2}
                    onValueChange={(value) =>
                      updateForm(
                        "pilot2",
                        value === "__none__"
                          ? ""
                          : value === formData.pilot1
                            ? formData.pilot2
                            : value
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={pilotsLoading ? "Loading pilots..." : "Select pilot"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {pilots.map((p) => (
                        <SelectItem
                          key={p.id}
                          value={p.fullName}
                          disabled={p.fullName === formData.pilot1}
                        >
                          {p.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date1">Date 1</Label>
                  <Input
                    id="date1"
                    type="date"
                    value={formData.date1}
                    onChange={(e) => updateForm("date1", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date2">Date 2</Label>
                  <Input
                    id="date2"
                    type="date"
                    value={formData.date2}
                    onChange={(e) => updateForm("date2", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="departure">Departure</Label>
                  <Input
                    id="departure"
                    value={formData.departure}
                    onChange={(e) => updateForm("departure", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arrival">Arrival</Label>
                  <Input
                    id="arrival"
                    value={formData.arrival}
                    onChange={(e) => updateForm("arrival", e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">{isEditMode ? "Update" : "Save"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="search" className="text-sm font-medium whitespace-nowrap">
          Search:
        </Label>
        <Input
          id="search"
          type="text"
          placeholder="Search all columns..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs h-9"
        />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader>
              <TableRow className="bg-slate-100 border-b border-gray-300">
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className="font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:bg-slate-200 select-none border-r border-gray-300 last:border-r-0"
                    onClick={() => handleSort(column.key)}
                  >
                    <div className="flex items-center gap-1">
                      {column.label}
                      {getSortIcon(column.key)}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-slate-50 border-b border-gray-300">
                    <TableCell className="font-medium whitespace-nowrap border-r border-gray-200">
                      {row.name}
                    </TableCell>
                    <TableCell className="border-r border-gray-200">{row.code}</TableCell>
                    <TableCell className="border-r border-gray-200">{row.pilot1}</TableCell>
                    <TableCell className="border-r border-gray-200">{row.pilot2}</TableCell>
                    <TableCell className="border-r border-gray-200">{row.date1}</TableCell>
                    <TableCell className="border-r border-gray-200">{row.date2}</TableCell>
                    <TableCell className="border-r border-gray-200">{row.departure}</TableCell>
                    <TableCell className="flex items-center justify-between gap-2">
                      <span>{row.arrival}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <IconDotsVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem onSelect={() => openEditDialog(row)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => handleDelete(row)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
          <div className="text-sm text-muted-foreground">
            Showing {totalEntries === 0 ? 0 : startIndex + 1} to {endIndex} of{" "}
            {totalEntries} entries
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {itemsPerPage} entries per page
              </span>
              <Select
                value={String(itemsPerPage)}
                onValueChange={(value) => {
                  setItemsPerPage(Number(value))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2"
              >
                «
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2"
              >
                ‹
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2"
              >
                ›
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="px-2"
              >
                »
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

