"use client"

import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import { IconArrowsSort, IconDotsVertical, IconSortAscending, IconSortDescending, IconTrash, IconEye } from "@tabler/icons-react"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

interface HazardReport {
  id: number
  reportNo: string | null
  eventDate: string
  sourceType: string | null
  isAnonymous: boolean
  title: string | null
  details: string | null
  reportedBy: number | null
  createdAt: string
  updatedAt: string
  reporter: {
    id: number
    isim: string | null
    soyisim: string | null
    email: string
    departman: string | null
  } | null
}

type SortDirection = "asc" | "desc" | null
type SortField = keyof HazardReport | "reporterName" | null

interface ColumnDef {
  key: string
  label: string
  sortKey?: SortField
  getValue: (report: HazardReport) => string | number | boolean
}

const columns: ColumnDef[] = [
  { key: "reportNo", label: "Report No:", sortKey: "reportNo", getValue: (r) => r.reportNo || "" },
  { key: "eventDate", label: "Date", sortKey: "eventDate", getValue: (r) => r.eventDate || "" },
  { key: "sourceType", label: "Source", sortKey: "sourceType", getValue: (r) => r.sourceType || "-" },
  { key: "title", label: "Title", sortKey: "title", getValue: (r) => r.title || "-" },
  { key: "reporterName", label: "Reporter", sortKey: "reporterName", getValue: (r) => r.isAnonymous ? "Anonymous" : (r.reporter ? `${r.reporter.isim || ""} ${r.reporter.soyisim || ""}`.trim() || r.reporter.email : "-") },
  { key: "reporterDepartment", label: "Department", sortKey: null, getValue: (r) => r.isAnonymous ? "-" : (r.reporter?.departman || "-") },
  { key: "isAnonymous", label: "Anonymous", sortKey: "isAnonymous", getValue: (r) => r.isAnonymous ? "Yes" : "No" },
  { key: "createdAt", label: "Reported At", sortKey: "createdAt", getValue: (r) => r.createdAt || "" },
]

export function HazardReportManagement() {
  const [reports, setReports] = useState<HazardReport[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<HazardReport | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  // Fetch hazard reports
  const fetchReports = async () => {
    try {
      const response = await fetch("/api/hazard-reports")
      if (response.ok) {
        const data = await response.json()
        setReports(data)
      }
    } catch (error) {
      console.error("Error fetching hazard reports:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  // Date formatting (dd.mm.yyyy - Turkey format)
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

  // Date and time formatting
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-"
    try {
      const date = new Date(dateString)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${day}.${month}.${year} ${hours}:${minutes}`
    } catch {
      return "-"
    }
  }

  // Handle sort
  const handleSort = (field: SortField) => {
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

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <IconArrowsSort className="h-4 w-4 text-gray-400" />
    }
    if (sortDirection === "asc") {
      return <IconSortAscending className="h-4 w-4 text-gray-700" />
    }
    return <IconSortDescending className="h-4 w-4 text-gray-700" />
  }

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let data = [...reports]

    // Filter by search term
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      data = data.filter((report) => {
        const reporterName = report.isAnonymous 
          ? "anonymous" 
          : `${report.reporter?.isim || ""} ${report.reporter?.soyisim || ""}`.toLowerCase()
        const searchableFields = [
          report.reportNo, // BON-HR-001 formatında arama için
          formatDate(report.eventDate),
          report.sourceType,
          report.title,
          report.details,
          reporterName,
          report.reporter?.email,
          report.reporter?.departman,
        ]
        return searchableFields.some((field) => field?.toLowerCase().includes(lowerSearch))
      })
    }

    // Sort data
    if (sortField && sortDirection) {
      data.sort((a, b) => {
        let aValue: string | number | boolean
        let bValue: string | number | boolean

        if (sortField === "reporterName") {
          aValue = a.isAnonymous 
            ? "anonymous" 
            : `${a.reporter?.isim || ""} ${a.reporter?.soyisim || ""}`.trim().toLowerCase() || a.reporter?.email || ""
          bValue = b.isAnonymous 
            ? "anonymous" 
            : `${b.reporter?.isim || ""} ${b.reporter?.soyisim || ""}`.trim().toLowerCase() || b.reporter?.email || ""
        } else {
          aValue = (a[sortField] ?? "").toString().toLowerCase()
          bValue = (b[sortField] ?? "").toString().toLowerCase()
        }

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
        return 0
      })
    }

    return data
  }, [reports, searchTerm, sortField, sortDirection])

  // Pagination
  const totalEntries = filteredAndSortedData.length
  const totalPages = Math.ceil(totalEntries / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, totalEntries)
  const paginatedReports = filteredAndSortedData.slice(startIndex, endIndex)

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // Handle delete
  const handleDelete = async (reportId: number) => {
    if (confirm("Are you sure you want to delete this report?")) {
      try {
        const response = await fetch(`/api/hazard-reports/${reportId}`, {
          method: "DELETE",
        })
        if (response.ok) {
          fetchReports()
        } else {
          alert("Failed to delete report")
        }
      } catch (error) {
        console.error("Delete error:", error)
        alert("An error occurred")
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Hazard Reports</h2>
      </div>

      {/* Search Bar */}
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

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader>
              <TableRow className="bg-slate-100 border-b border-gray-300">
                {columns.map((column) => (
                  <TableHead 
                    key={column.key}
                    className="font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:bg-slate-200 select-none border-r border-gray-300 last:border-r-0"
                    onClick={() => column.sortKey && handleSort(column.sortKey)}
                  >
                    <div className="flex items-center gap-1">
                      {column.label}
                      {column.sortKey && getSortIcon(column.sortKey)}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-10 border-r-0">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : paginatedReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center py-8 text-muted-foreground">
                    No reports found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedReports.map((report) => (
                  <TableRow key={report.id} className="hover:bg-slate-50 border-b border-gray-300">
                    <TableCell className="whitespace-nowrap border-r border-gray-200 font-medium">
                      {report.reportNo || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap border-r border-gray-200">
                      {formatDate(report.eventDate)}
                    </TableCell>
                    <TableCell className="border-r border-gray-200">
                      {report.sourceType ? (
                        <Badge variant="outline">{report.sourceType}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate border-r border-gray-200">
                      {report.title || "-"}
                    </TableCell>
                    <TableCell className="border-r border-gray-200">
                      {report.isAnonymous ? (
                        <Badge variant="secondary">Anonymous</Badge>
                      ) : (
                        report.reporter 
                          ? `${report.reporter.isim || ""} ${report.reporter.soyisim || ""}`.trim() || report.reporter.email
                          : "-"
                      )}
                    </TableCell>
                    <TableCell className="border-r border-gray-200">
                      {report.isAnonymous ? "-" : (report.reporter?.departman || "-")}
                    </TableCell>
                    <TableCell className="border-r border-gray-200">
                      {report.isAnonymous ? (
                        <Badge variant="secondary">Yes</Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </TableCell>
                    <TableCell className="border-r border-gray-200">
                      {formatDateTime(report.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setSelectedReport(report)
                            setViewDialogOpen(true)
                          }}
                        >
                          <IconEye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(report.id)}
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
          {/* Showing entries info */}
          <div className="text-sm text-muted-foreground">
            Showing {totalEntries === 0 ? 0 : startIndex + 1} to {endIndex} of {totalEntries} entries
          </div>

          {/* Pagination controls */}
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

      {/* View Report Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Hazard Report Details</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            {selectedReport && (
              <div className="space-y-4 p-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Report No</Label>
                    <p className="text-sm font-medium">{selectedReport.reportNo || "-"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Event Date</Label>
                    <p className="text-sm">{formatDate(selectedReport.eventDate)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Source Type</Label>
                    <p className="text-sm">{selectedReport.sourceType || "-"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Anonymous</Label>
                    <p className="text-sm">
                      {selectedReport.isAnonymous ? "Yes" : "No"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Reported At</Label>
                    <p className="text-sm">{formatDateTime(selectedReport.createdAt)}</p>
                  </div>
                </div>
                
                {!selectedReport.isAnonymous && selectedReport.reporter && (
                  <div className="grid grid-cols-2 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Reporter</Label>
                      <p className="text-sm">
                        {`${selectedReport.reporter.isim || ""} ${selectedReport.reporter.soyisim || ""}`.trim() || selectedReport.reporter.email}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Department</Label>
                      <p className="text-sm">{selectedReport.reporter.departman || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Email</Label>
                      <p className="text-sm">{selectedReport.reporter.email}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2 border-t pt-4">
                  <Label className="text-sm font-semibold">Title</Label>
                  <p className="text-sm">{selectedReport.title || "-"}</p>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <Label className="text-sm font-semibold">Details</Label>
                  <p className="text-sm whitespace-pre-wrap">{selectedReport.details || "-"}</p>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}

