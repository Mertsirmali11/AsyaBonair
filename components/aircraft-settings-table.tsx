"use client"
import * as React from "react"
import { useRouter } from "next/navigation"
import { IconPlus, IconDotsVertical } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

interface Aircraft {
  id: number
  register: string
  msn: string
}

export function AircraftSettingsTable() {
  const router = useRouter()
  const [aircraft, setAircraft] = React.useState<Aircraft[]>([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [register, setRegister] = React.useState("")
  const [msn, setMsn] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [itemsPerPage, setItemsPerPage] = React.useState(10)

  const fetchAircraft = async () => {
    const res = await fetch("/api/aircraft")
    if (res.ok) setAircraft(await res.json())
  }

  React.useEffect(() => { fetchAircraft() }, [])

  const filtered = aircraft.filter(a =>
    `${a.register} ${a.msn}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginated = filtered.slice(startIndex, startIndex + itemsPerPage)

  const handleAdd = async () => {
    if (!register || !msn) return
    setSaving(true)
    await fetch("/api/aircraft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ register, msn }),
    })
    setSaving(false)
    setDialogOpen(false)
    setRegister("")
    setMsn("")
    fetchAircraft()
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    await fetch(`/api/aircraft?id=${id}`, { method: "DELETE" })
    fetchAircraft()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Aircraft List</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-700 hover:bg-slate-800">
              <IconPlus className="mr-2 h-4 w-4" />
              Add Aircraft
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Aircraft</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 mt-2">
              <div>
                <Label>Register *</Label>
                <Input value={register} onChange={e => setRegister(e.target.value)} placeholder="TC-XXX" className="mt-1" />
              </div>
              <div>
                <Label>MSN *</Label>
                <Input value={msn} onChange={e => setMsn(e.target.value)} placeholder="MSN" className="mt-1" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAdd} disabled={saving || !register || !msn}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium whitespace-nowrap">Search:</Label>
        <Input
          placeholder="Search all columns..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="max-w-xs h-9"
        />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader>
              <TableRow className="bg-slate-100 border-b border-gray-300">
                <TableHead className="font-semibold text-slate-700 border-r border-gray-300">Register</TableHead>
                <TableHead className="font-semibold text-slate-700 border-r border-gray-300">MSN</TableHead>
                <TableHead className="font-semibold text-slate-700">Documents</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    No aircraft found.
                  </TableCell>
                </TableRow>
              ) : paginated.map(a => (
                <TableRow
                  key={a.id}
                  className="hover:bg-slate-50 border-b border-gray-300 cursor-pointer"
                  onClick={() => router.push(`/configurations/aircraft-settings/${a.id}`)}
                >
                  <TableCell className="font-medium border-r border-gray-200">{a.register}</TableCell>
                  <TableCell className="border-r border-gray-200">{a.msn}</TableCell>
                  <TableCell className="flex items-center justify-between">
                    <span className="text-blue-600 text-sm hover:underline">View Documents →</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <IconDotsVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onSelect={() => router.push(`/configurations/aircraft-settings/${a.id}`)}>
                          View Documents
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => handleDelete(a.id, a.register)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
          <div className="text-sm text-muted-foreground">
            Showing {filtered.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + itemsPerPage, filtered.length)} of {filtered.length} entries
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">{itemsPerPage} entries per page</span>
              <Select value={String(itemsPerPage)} onValueChange={v => { setItemsPerPage(Number(v)); setCurrentPage(1) }}>
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
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-2">«</Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2">‹</Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="px-2">›</Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages} className="px-2">»</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}