"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs"
import { FileText, Upload, Archive, ArchiveRestore, Trash2, ExternalLink, Plus } from "lucide-react"

const CERTIFICATE_TYPES = [
  "Airworthiness Certificate",
  "Airworthiness Review Certificate",
  "Insurance",
  "Registration",
  "Radio License",
  "Noise Certificate",
  "Weight & Balance",
]

const MANUAL_TYPES = [
  "Aircraft Flight Manual (AFM)",
  "Minimum Equipment List (MEL)",
  "Weight & Balance Manual",
  "Maintenance Manual",
  "OM Part- B",
  "QRH V1",
  "QRH V2",
  "AOM",
 
]

interface Aircraft { id: number; register: string; msn: string }
interface Doc {
  id: number
  category: string
  docType: string
  fileName: string
  filePath: string
  fileSize: number | null
  validFrom: string | null
  validUntil: string | null
  isArchived: boolean
  createdAt: string
  uploader: { isim: string | null; soyisim: string | null } | null
}

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const isExpiringSoon = (date: string) => {
  const diff = (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return diff <= 30 && diff >= 0
}

const isExpired = (date: string) => new Date(date) < new Date()

export function AircraftDetailClient({
  aircraft,
  currentUserId,
}: {
  aircraft: Aircraft
  currentUserId: number
}) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("certificate")
  const [docType, setDocType] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [validFrom, setValidFrom] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const fetchDocs = async () => {
    const res = await fetch(`/api/aircraft/${aircraft.id}/documents`)
    if (res.ok) setDocs(await res.json())
  }

  useEffect(() => { fetchDocs() }, [aircraft.id])

  const filtered = (category: string) =>
    docs.filter(d => d.category === category && d.isArchived === showArchived)

  const handleUpload = async () => {
    if (!file || !docType) return
    setError("")
    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("category", activeTab)
    formData.append("docType", docType)
    if (validFrom) formData.append("validFrom", validFrom)
    if (validUntil) formData.append("validUntil", validUntil)
    formData.append("uploadedBy", String(currentUserId))

    const res = await fetch(`/api/aircraft/${aircraft.id}/documents`, {
      method: "POST",
      body: formData,
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Upload failed")
    } else {
      setOpen(false)
      setDocType(""); setFile(null); setValidFrom(""); setValidUntil("")
      fetchDocs()
    }
    setUploading(false)
  }

  const toggleArchive = async (doc: Doc) => {
    await fetch(`/api/aircraft/${aircraft.id}/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: !doc.isArchived }),
    })
    fetchDocs()
  }

  const deleteDoc = async (doc: Doc) => {
    if (!confirm(`Delete "${doc.fileName}"?`)) return
    await fetch(`/api/aircraft/${aircraft.id}/documents/${doc.id}`, { method: "DELETE" })
    fetchDocs()
  }

  const DocList = ({ category }: { category: string }) => {
    const list = filtered(category)
    return (
      <div className="flex flex-col gap-3 mt-4">
        {list.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No documents found.</p>
        ) : list.map(doc => (
          <div key={doc.id} className="border rounded-lg p-4 bg-white flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <FileText size={20} className="text-red-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{doc.fileName}</span>
                  <Badge variant="outline" className="text-xs">{doc.docType}</Badge>
                  {doc.validUntil && isExpired(doc.validUntil) && (
                    <Badge className="bg-red-100 text-red-700 text-xs">Expired</Badge>
                  )}
                  {doc.validUntil && isExpiringSoon(doc.validUntil) && !isExpired(doc.validUntil) && (
                    <Badge className="bg-yellow-100 text-yellow-700 text-xs">Expiring Soon</Badge>
                  )}
                </div>
                <div className="flex gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                  {doc.fileSize && <span>{formatSize(doc.fileSize)}</span>}
                  {doc.validFrom && <span>From: {new Date(doc.validFrom).toLocaleDateString("en-US")}</span>}
                  {doc.validUntil && <span>Until: {new Date(doc.validUntil).toLocaleDateString("en-US")}</span>}
                  {doc.uploader && <span>By: {doc.uploader.isim} {doc.uploader.soyisim}</span>}
                  <span>{new Date(doc.createdAt).toLocaleDateString("en-US")}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <a href={doc.filePath} target="_blank" rel="noreferrer"
                className="p-1.5 rounded hover:bg-gray-100 text-blue-600">
                <ExternalLink size={15} />
              </a>
              <button onClick={() => toggleArchive(doc)}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                {doc.isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
              </button>
              <button onClick={() => deleteDoc(doc)}
                className="p-1.5 rounded hover:bg-gray-100 text-red-400">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0 md:p-6 md:pt-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{aircraft.register}</h1>
          <p className="text-muted-foreground text-sm">MSN: {aircraft.msn}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${showArchived ? "bg-gray-800 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
          >
            <Archive size={14} />
            {showArchived ? "Show Active" : "Show Archived"}
          </button>
          <Button type="button" onClick={() => setOpen(true)} className="gap-2">
            <Plus className="size-4 shrink-0" /> Upload Document
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="certificate">
            Certificates
            <Badge className="ml-2 bg-blue-100 text-blue-700 text-xs">
              {docs.filter(d => d.category === "certificate" && !d.isArchived).length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="manual">
            Manuals
            <Badge className="ml-2 bg-blue-100 text-blue-700 text-xs">
              {docs.filter(d => d.category === "manual" && !d.isArchived).length}
            </Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="certificate"><DocList category="certificate" /></TabsContent>
        <TabsContent value="manual"><DocList category="manual" /></TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setDocType(""); setFile(null); setError("") } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label>Category</Label>
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="certificate">Certificate</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Document Type <span className="text-red-500">*</span></Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {(activeTab === "certificate" ? CERTIFICATE_TYPES : MANUAL_TYPES).map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valid From</Label>
              <Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Valid Until</Label>
              <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>File (PDF, max 50MB) <span className="text-red-500">*</span></Label>
              <Input type="file" accept=".pdf" className="mt-1"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
              {file && (
                <p className="text-xs text-gray-500 mt-1">
                  {file.name} — {formatSize(file.size)}
                  {file.size > 50 * 1024 * 1024 && <span className="text-red-500 ml-2">Exceeds 50MB!</span>}
                </p>
              )}
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button
              onClick={handleUpload}
              disabled={uploading || !file || !docType || (file?.size ?? 0) > 50 * 1024 * 1024}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Upload size={14} className="mr-2" />
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
