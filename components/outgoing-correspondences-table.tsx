"use client"

import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import {
  IconArrowsSort,
  IconPencil,
  IconPlus,
  IconSortAscending,
  IconSortDescending,
  IconTrash,
} from "@tabler/icons-react"
import { CorrespondenceAttachmentsCell } from "@/components/correspondence-attachments-cell"
import { OutgoingCorrespondenceDialog } from "@/components/outgoing-correspondence-dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  getOutgoingAttachmentsFromRow,
  outgoingAttachmentProxyUrl,
} from "@/lib/outgoing-correspondence-attachments"

interface OutgoingCorrespondence {
  id: number
  paperNo: string | null
  departmentKey?: string | null
  departmentLabel?: string | null
  to: string | null
  subject: string | null
  date: string
  content: string | null
  pdfPath: string | null
  pdfFileName: string | null
  pdfAttachments?: unknown
  createdBy: number | null
  createdAt: string
  creator: {
    id: number
    isim: string | null
    soyisim: string | null
    email: string
    departman: string | null
  } | null
}

type SortDirection = "asc" | "desc" | null
type SortField = keyof OutgoingCorrespondence | null

interface ColumnDef {
  key: string
  label: string
  sortKey?: SortField
  getValue: (correspondence: OutgoingCorrespondence) => string | number
}

const columns: ColumnDef[] = [
  {
    key: "paperNo",
    label: "Correspondence no",
    sortKey: "paperNo",
    getValue: (c) => c.paperNo || "-",
  },
  {
    key: "department",
    label: "Department",
    sortKey: "departmentLabel",
    getValue: (c) => c.departmentLabel || "—",
  },
  { key: "to", label: "To", sortKey: "to", getValue: (c) => c.to || "-" },
  { key: "subject", label: "Subject", sortKey: "subject", getValue: (c) => c.subject || "-" },
  { key: "date", label: "Date", sortKey: "date", getValue: (c) => c.date || "" },
  { key: "content", label: "Content", sortKey: null, getValue: (c) => c.content || "-" },
  {
    key: "attachment",
    label: "Attachment",
    sortKey: null,
    getValue: (c) =>
      getOutgoingAttachmentsFromRow(c)
        .map((a) => a.fileName)
        .join(", ") || "-",
  },
  { key: "uploadedBy", label: "Uploaded By", sortKey: null, getValue: (c) => c.creator ? `${c.creator.isim || ""} ${c.creator.soyisim || ""}`.trim() || c.creator.email : "-" },
]

export function OutgoingCorrespondencesTable({ userId }: { userId: string }) {
  const [correspondences, setCorrespondences] = useState<OutgoingCorrespondence[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [editRecord, setEditRecord] = useState<OutgoingCorrespondence | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<OutgoingCorrespondence | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchCorrespondences = async () => {
    try {
      const response = await fetch("/api/outgoing-correspondences", {
        cache: "no-store",
      })
      if (response.ok) {
        const data = await response.json()
        setCorrespondences(data)
      }
    } catch (error) {
      console.error("Error fetching outgoing correspondences:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCorrespondences()
  }, [])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    try {
      const date = new Date(dateString)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      return `${day}.${month}.${year}`
    } catch {
      return "-"
    }
  }

  const handleSort = (field: SortField) => {
    if (!field) return
    
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else if (sortDirection === "desc") {
        setSortField(null)
        setSortDirection(null)
      } else {
        setSortDirection("asc")
      }
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const getSortIcon = (field: SortField) => {
    if (!field) return null
    if (sortField !== field) {
      return <IconArrowsSort className="h-4 w-4 text-gray-400" />
    }
    if (sortDirection === "asc") {
      return <IconSortAscending className="h-4 w-4 text-gray-700" />
    }
    return <IconSortDescending className="h-4 w-4 text-gray-700" />
  }

  const filteredAndSortedData = useMemo(() => {
    let data = [...correspondences]

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      data = data.filter((correspondence) => {
        const searchableFields = [
          correspondence.paperNo,
          correspondence.departmentLabel,
          correspondence.departmentKey,
          correspondence.to,
          correspondence.subject,
          formatDate(correspondence.date),
          correspondence.content,
          ...getOutgoingAttachmentsFromRow(correspondence).map((a) => a.fileName),
          correspondence.creator ? `${correspondence.creator.isim || ""} ${correspondence.creator.soyisim || ""}` : "",
        ]
        return searchableFields.some((field) => field?.toLowerCase().includes(lowerSearch))
      })
    }

    if (sortField && sortDirection) {
      data.sort((a, b) => {
        let aValue: string | number
        let bValue: string | number

        if (sortField === "date") {
          aValue = new Date(a[sortField] as string).getTime()
          bValue = new Date(b[sortField] as string).getTime()
        } else {
          aValue = ((a[sortField] ?? "") as string).toString().toLowerCase()
          bValue = ((b[sortField] ?? "") as string).toString().toLowerCase()
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
        }
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue
        }
        return 0
      })
    }

    return data
  }, [correspondences, searchTerm, sortField, sortDirection])

  const totalEntries = filteredAndSortedData.length
  const totalPages = Math.ceil(totalEntries / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, totalEntries)
  const paginatedCorrespondences = filteredAndSortedData.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const openCreate = () => {
    setFormMode("create")
    setEditRecord(null)
    setFormOpen(true)
  }

  const openEdit = (row: OutgoingCorrespondence) => {
    setFormMode("edit")
    setEditRecord(row)
    setFormOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/outgoing-correspondences/${deleteTarget.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Could not delete")
        return
      }
      setDeleteTarget(null)
      await fetchCorrespondences()
    } finally {
      setDeleting(false)
    }
  }

  const colCount = columns.length + 1

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold">Correspondences</h2>
        <Button type="button" onClick={openCreate} className="gap-1.5 shrink-0 self-end sm:self-auto">
          <IconPlus className="size-4" />
          New correspondence
        </Button>
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
                    className={
                      "font-semibold text-slate-700 cursor-pointer hover:bg-slate-200 select-none border-r border-gray-300 last:border-r-0 " +
                      (column.key === "department"
                        ? "min-w-[12rem] max-w-[16rem]"
                        : "whitespace-nowrap")
                    }
                    onClick={() => handleSort(column.sortKey || null)}
                  >
                    <div className="flex items-center gap-1">
                      {column.label}
                      {column.sortKey && getSortIcon(column.sortKey)}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="w-[140px] min-w-[140px] border-l border-gray-300 text-right font-semibold text-slate-700">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={colCount} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : paginatedCorrespondences.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground">
                    No papers found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCorrespondences.map((correspondence) => {
                  const attachments = getOutgoingAttachmentsFromRow(correspondence)
                  return (
                    <TableRow key={correspondence.id} className="hover:bg-slate-50 border-b border-gray-300">
                      <TableCell className="whitespace-nowrap border-r border-gray-200 font-mono text-sm">
                        {correspondence.paperNo || "—"}
                      </TableCell>
                      <TableCell className="align-top border-r border-gray-200 text-sm">
                        <div className="max-w-[12rem] min-w-0 break-words sm:max-w-[16rem]">
                          {correspondence.departmentLabel || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap border-r border-gray-200">
                        {correspondence.to || "-"}
                      </TableCell>
                      <TableCell className="border-r border-gray-200">
                        {correspondence.subject || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap border-r border-gray-200">
                        {formatDate(correspondence.date)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate border-r border-gray-200">
                        {correspondence.content || "-"}
                      </TableCell>
                      <TableCell className="border-r border-gray-200 align-middle">
                        <CorrespondenceAttachmentsCell
                          attachments={attachments}
                          getHref={outgoingAttachmentProxyUrl}
                        />
                      </TableCell>
                      <TableCell className="border-r border-gray-200">
                        {correspondence.creator 
                          ? `${correspondence.creator.isim || ""} ${correspondence.creator.soyisim || ""}`.trim() || correspondence.creator.email
                          : "-"}
                      </TableCell>
                      <TableCell className="border-l border-gray-200 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => openEdit(correspondence)}
                          >
                            <IconPencil className="size-4 sm:mr-1" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive h-8 px-2"
                            onClick={() => setDeleteTarget(correspondence)}
                          >
                            <IconTrash className="size-4 sm:mr-1" />
                            <span className="hidden sm:inline">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
          <div className="text-sm text-muted-foreground">
            Showing {totalEntries === 0 ? 0 : startIndex + 1} to {endIndex} of {totalEntries} entries
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">{itemsPerPage} entries per page</span>
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

      <OutgoingCorrespondenceDialog
        userId={userId}
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        record={editRecord}
        onSaved={() => void fetchCorrespondences()}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete correspondence?</DialogTitle>
            <DialogDescription>
              This will remove the record and delete the PDF from storage if one exists.
              {deleteTarget && (
                <span className="mt-2 block font-medium text-foreground">
                  {deleteTarget.subject || "Untitled"}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

