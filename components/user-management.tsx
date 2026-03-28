"use client"

import * as React from "react"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { usePathname } from "next/navigation"
import { IconArrowsSort, IconDotsVertical, IconPencil, IconPlus, IconSortAscending, IconSortDescending, IconTrash } from "@tabler/icons-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DatePicker } from "@/components/ui/date-picker"

interface Calisan {
  id: number
  isim: string | null
  soyisim: string | null
  departman: string | null
  tcNo: string | null
  dogumTarihi: string | null
  telNo: string | null
  adres: string | null
  anneAdi: string | null
  babaAdi: string | null
  medeniDurum: string | null
  cocuk: number
  kanGrubu: string | null
  email: string
  egitimDurum: string | null
  acilIletisim: string | null
  acilIletisimTel: string | null
  sgkSicilNo: string | null
  bankaAdi: string | null
  iban: string | null
  iseGirisTarihi: string | null
  istenCikisTarihi: string | null
  ekstra1: string | null
  ekstra2: string | null
  ekstra3: string | null
  profilFotoUrl?: string | null
}

type SortDirection = "asc" | "desc" | null
type SortField = keyof Calisan | "fullName" | null

interface ColumnDef {
  key: string
  label: string
  sortKey?: keyof Calisan | "fullName"
  getValue: (calisan: Calisan) => string | number
}

const defaultColumns: ColumnDef[] = [
  { key: "fullName", label: "NAME-SURNAME", sortKey: "fullName", getValue: (c) => `${c.isim || ""} ${c.soyisim || ""}`.trim() },
  { key: "departman", label: "Department", sortKey: "departman", getValue: (c) => c.departman || "-" },
  { key: "tcNo", label: "ID Number", sortKey: "tcNo", getValue: (c) => c.tcNo || "-" },
  { key: "dogumTarihi", label: "Date of Birth", sortKey: "dogumTarihi", getValue: (c) => c.dogumTarihi || "" },
  { key: "telNo", label: "Phone Number", sortKey: "telNo", getValue: (c) => c.telNo || "-" },
  { key: "adres", label: "Address", sortKey: "adres", getValue: (c) => c.adres || "-" },
  { key: "anneAdi", label: "Mother's Name", sortKey: "anneAdi", getValue: (c) => c.anneAdi || "-" },
  { key: "babaAdi", label: "Father's Name", sortKey: "babaAdi", getValue: (c) => c.babaAdi || "-" },
  { key: "medeniDurum", label: "Marital Status", sortKey: "medeniDurum", getValue: (c) => c.medeniDurum || "-" },
  { key: "cocuk", label: "Children", sortKey: "cocuk", getValue: (c) => c.cocuk ?? "-" },
  { key: "kanGrubu", label: "Blood Type", sortKey: "kanGrubu", getValue: (c) => c.kanGrubu || "-" },
  { key: "email", label: "Email", sortKey: "email", getValue: (c) => c.email || "-" },
  { key: "egitimDurum", label: "Education", sortKey: "egitimDurum", getValue: (c) => c.egitimDurum || "-" },
  { key: "acilIletisim", label: "Emergency Contact", sortKey: "acilIletisim", getValue: (c) => c.acilIletisim || "-" },
  { key: "acilIletisimTel", label: "Emergency Phone", sortKey: "acilIletisimTel", getValue: (c) => c.acilIletisimTel || "-" },
  { key: "sgkSicilNo", label: "SSN", sortKey: "sgkSicilNo", getValue: (c) => c.sgkSicilNo || "-" },
  { key: "bankaAdi", label: "Bank Name", sortKey: "bankaAdi", getValue: (c) => c.bankaAdi || "-" },
  { key: "iban", label: "IBAN", sortKey: "iban", getValue: (c) => c.iban || "-" },
  { key: "iseGirisTarihi", label: "Hire Date", sortKey: "iseGirisTarihi", getValue: (c) => c.iseGirisTarihi || "" },
  { key: "istenCikisTarihi", label: "Termination Date", sortKey: "istenCikisTarihi", getValue: (c) => c.istenCikisTarihi || "" },
]

const pilotColumns: ColumnDef[] = [
  { key: "fullName", label: "Ad Soyad", sortKey: "fullName", getValue: (c) => `${c.isim || ""} ${c.soyisim || ""}`.trim() },
  { key: "telNo", label: "Telefon", sortKey: "telNo", getValue: (c) => c.telNo || "-" },
  { key: "email", label: "Mail", sortKey: "email", getValue: (c) => c.email || "-" },
  { key: "ekstra3", label: "Captain / F/O", sortKey: "ekstra3", getValue: (c) => c.ekstra3 || "-" },
]

const pilotRanks = ["Captain", "F/O"] as const

const PROFILE_PHOTO_MAX_BYTES = 21 * 1024 * 1024
const CALISAN_LIST_RETRY_MS = 400
const CALISAN_LIST_RETRIES = 3

const initialFormData = {
  isim: "",
  soyisim: "",
  departman: "",
  tcNo: "",
  dogumTarihi: "",
  telNo: "",
  adres: "",
  anneAdi: "",
  babaAdi: "",
  medeniDurum: "",
  cocuk: "",
  kanGrubu: "",
  email: "",
  password: "",
  egitimDurum: "",
  acilIletisim: "",
  acilIletisimTel: "",
  sgkSicilNo: "",
  bankaAdi: "",
  iban: "",
  iseGirisTarihi: "",
  istenCikisTarihi: "",
  ekstra1: "",
  ekstra2: "",
  ekstra3: "",
}

interface UserManagementProps {
  departmentFilter?: string | null
  title?: string
}

export function UserManagement({ departmentFilter, title = "User Management" }: UserManagementProps) {
  const pathname = usePathname()
  const isPilotSettings = departmentFilter === "Pilot"
  const [calisanlar, setCalisanlar] = useState<Calisan[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const hasLoadedOnceRef = useRef(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState(initialFormData)
  const [submitting, setSubmitting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [selectedCalisan, setSelectedCalisan] = useState<Calisan | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const activeColumns = isPilotSettings ? pilotColumns : defaultColumns
  const selectedDepartment = departmentFilter || formData.departman
  const shouldShowPilotRankField = selectedDepartment === "Pilot"

  const fetchCalisanlar = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const silent = mode === "refresh" && hasLoadedOnceRef.current
    if (!silent) {
      setListError(null)
      setLoading(true)
    }

    let lastMsg = "Çalışan listesi yüklenemedi."
    for (let attempt = 0; attempt < CALISAN_LIST_RETRIES; attempt++) {
      try {
        const response = await fetch("/api/calisanlar", { cache: "no-store" })
        if (response.ok) {
          const data = (await response.json()) as unknown
          setCalisanlar(Array.isArray(data) ? (data as Calisan[]) : [])
          setListError(null)
          hasLoadedOnceRef.current = true
          setLoading(false)
          return
        }
        lastMsg =
          response.status >= 500
            ? "Sunucu geçici olarak yanıt vermedi. Bir süre sonra tekrar deneyin."
            : "Liste alınamadı."
        await new Promise((r) => setTimeout(r, CALISAN_LIST_RETRY_MS * (attempt + 1)))
      } catch {
        lastMsg = "Bağlantı kesildi veya zaman aşımı oluştu."
        await new Promise((r) => setTimeout(r, CALISAN_LIST_RETRY_MS * (attempt + 1)))
      }
    }

    setListError(lastMsg)
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchCalisanlar("initial")
  }, [fetchCalisanlar, pathname])

  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void fetchCalisanlar("refresh")
    }
    window.addEventListener("pageshow", onShow)
    return () => window.removeEventListener("pageshow", onShow)
  }, [fetchCalisanlar])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      if (!listError) return
      void fetchCalisanlar("refresh")
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [fetchCalisanlar, listError])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleProfilePhotoChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !selectedCalisan) return
    if (file.size > PROFILE_PHOTO_MAX_BYTES) {
      alert("Photo must be at most 21 MB.")
      return
    }
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file (JPEG, PNG, GIF, or WebP).")
      return
    }
    setAvatarUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/calisanlar/${selectedCalisan.id}/avatar`, {
        method: "POST",
        body: fd,
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        profilFotoUrl?: string
      }
      if (!res.ok) {
        alert(data.error || "Upload failed")
        return
      }
      setSelectedCalisan((s) =>
        s ? { ...s, profilFotoUrl: data.profilFotoUrl ?? null } : null
      )
      void fetchCalisanlar("refresh")
    } catch {
      alert("Upload failed")
    } finally {
      setAvatarUploading(false)
    }
  }

  const removeProfilePhoto = async () => {
    if (!selectedCalisan) return
    setAvatarUploading(true)
    try {
      const res = await fetch(`/api/calisanlar/${selectedCalisan.id}/avatar`, {
        method: "DELETE",
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        alert(data.error || "Could not remove photo")
        return
      }
      setSelectedCalisan((s) => (s ? { ...s, profilFotoUrl: null } : null))
      void fetchCalisanlar("refresh")
    } catch {
      alert("Could not remove photo")
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (shouldShowPilotRankField && !pilotRanks.includes(formData.ekstra3 as (typeof pilotRanks)[number])) {
        alert("Pilot position must be Captain or F/O.")
        setSubmitting(false)
        return
      }

      const url = isEditMode && selectedCalisan 
        ? `/api/calisanlar/${selectedCalisan.id}` 
        : "/api/calisanlar"
      
      const submitData = {
        ...formData,
        departman: departmentFilter || formData.departman,
        ekstra3: shouldShowPilotRankField ? formData.ekstra3 : "",
        dogumTarihi: turkeyToIsoFormat(formData.dogumTarihi),
        iseGirisTarihi: turkeyToIsoFormat(formData.iseGirisTarihi),
        istenCikisTarihi: turkeyToIsoFormat(formData.istenCikisTarihi),
      }
      
      const response = await fetch(url, {
        method: isEditMode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      })

      if (response.ok) {
        setDialogOpen(false)
        const newFormData = departmentFilter 
          ? { ...initialFormData, departman: departmentFilter }
          : initialFormData
        setFormData(newFormData)
        setIsEditMode(false)
        setSelectedCalisan(null)
        void fetchCalisanlar("refresh")
      } else {
        const error = await response.json()
        alert(error.error || "An error occurred")
      }
    } catch (error) {
      console.error("Error saving employee:", error)
      alert("An error occurred")
    } finally {
      setSubmitting(false)
    }
  }

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

  const isoToTurkeyFormat = (isoDate: string | null) => {
    if (!isoDate) return ""
    try {
      const date = new Date(isoDate)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      return `${day}.${month}.${year}`
    } catch {
      return ""
    }
  }

  const turkeyToIsoFormat = (turkeyDate: string) => {
    if (!turkeyDate) return ""
    const parts = turkeyDate.split(".")
    if (parts.length !== 3) return turkeyDate
    const [day, month, year] = parts
    return `${year}-${month}-${day}`
  }

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

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <IconArrowsSort className="h-4 w-4 text-gray-400" />
    }
    if (sortDirection === "asc") {
      return <IconSortAscending className="h-4 w-4 text-gray-700" />
    }
    return <IconSortDescending className="h-4 w-4 text-gray-700" />
  }

  const filteredAndSortedData = useMemo(() => {
    let data = [...calisanlar]

    if (departmentFilter) {
      data = data.filter((calisan) => calisan.departman === departmentFilter)
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      data = data.filter((calisan) => {
        const fullName = `${calisan.isim || ""} ${calisan.soyisim || ""}`.toLowerCase()
        const searchableFields = isPilotSettings
          ? [fullName, calisan.telNo, calisan.email, calisan.ekstra3]
          : [
              fullName,
              calisan.departman,
              calisan.tcNo,
              calisan.telNo,
              calisan.adres,
              calisan.email,
              calisan.anneAdi,
              calisan.babaAdi,
              calisan.medeniDurum,
            ]
        return searchableFields.some((field) => field?.toLowerCase().includes(lowerSearch))
      })
    }

    if (sortField && sortDirection) {
      data.sort((a, b) => {
        let aValue: string | number
        let bValue: string | number

        if (sortField === "fullName") {
          aValue = `${a.isim || ""} ${a.soyisim || ""}`.trim().toLowerCase()
          bValue = `${b.isim || ""} ${b.soyisim || ""}`.trim().toLowerCase()
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
  }, [calisanlar, searchTerm, sortField, sortDirection, departmentFilter, isPilotSettings])

  const totalEntries = filteredAndSortedData.length
  const totalPages = Math.ceil(totalEntries / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, totalEntries)
  const paginatedCalisanlar = filteredAndSortedData.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  return (
    <div className="space-y-4">
      {listError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{listError}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-600/40 bg-white/80 dark:bg-background"
            onClick={() => void fetchCalisanlar("initial")}
          >
            Yeniden dene
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <div className="flex shrink-0 justify-end sm:justify-end">
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setIsEditMode(false)
            setSelectedCalisan(null)
            const newFormData = departmentFilter 
              ? { ...initialFormData, departman: departmentFilter }
              : initialFormData
            setFormData(newFormData)
          }
        }}>
          <DialogTrigger asChild>
            <Button
              className="gap-2"
              onClick={() => {
                setIsEditMode(false)
                setSelectedCalisan(null)
                const newFormData = departmentFilter 
                  ? { ...initialFormData, departman: departmentFilter }
                  : initialFormData
                setFormData(newFormData)
              }}
            >
              <IconPlus className="size-4 shrink-0" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{isEditMode ? "Edit User" : "Add New User"}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <form onSubmit={handleSubmit} className="space-y-6 p-1">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Personal Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="isim">First Name *</Label>
                      <Input
                        id="isim"
                        name="isim"
                        value={formData.isim}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="soyisim">Last Name *</Label>
                      <Input
                        id="soyisim"
                        name="soyisim"
                        value={formData.soyisim}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">
                        {isEditMode ? "Password (enter new password to change)" : "Password *"}
                      </Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder={isEditMode ? "••••••••" : ""}
                        required={!isEditMode}
                      />
                      {isEditMode && (
                        <p className="text-xs text-muted-foreground">
                          Leave empty to keep current password
                        </p>
                      )}
                    </div>
                    {isEditMode && selectedCalisan && (
                      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                        <Label>Profile photo</Label>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <Avatar className="size-20 shrink-0 ring-2 ring-background">
                            <AvatarImage
                              src={selectedCalisan.profilFotoUrl ?? undefined}
                              alt=""
                            />
                            <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                              {`${selectedCalisan.isim?.[0] ?? ""}${selectedCalisan.soyisim?.[0] ?? ""}`.toUpperCase() ||
                                "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <Input
                              type="file"
                              accept="image/jpeg,image/png,image/gif,image/webp"
                              disabled={avatarUploading}
                              onChange={(ev) => void handleProfilePhotoChange(ev)}
                              className="cursor-pointer text-sm file:mr-2"
                            />
                            <p className="text-xs text-muted-foreground">
                              JPEG, PNG, GIF or WebP — max 21 MB. Saves immediately.
                            </p>
                            {selectedCalisan.profilFotoUrl ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-fit"
                                disabled={avatarUploading}
                                onClick={() => void removeProfilePhoto()}
                              >
                                Remove photo
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )}
                    {isPilotSettings ? (
                      <div className="space-y-2">
                        <Label htmlFor="ekstra3">Position *</Label>
                        <Select
                          value={formData.ekstra3}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, ekstra3: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select position" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Captain">Captain</SelectItem>
                            <SelectItem value="F/O">F/O</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="departman">Department</Label>
                          <Select
                            value={formData.departman}
                            onValueChange={(value) => setFormData((prev) => ({ ...prev, departman: value }))}
                            disabled={!!departmentFilter}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Maintenance">Maintenance</SelectItem>
                              <SelectItem value="Human Resources">Human Resources</SelectItem>
                              <SelectItem value="Handling">Handling</SelectItem>
                              <SelectItem value="Camo">Camo</SelectItem>
                              <SelectItem value="Engineering">Engineering</SelectItem>
                              <SelectItem value="Kitchen & Cleaning Staff">Kitchen & Cleaning Staff</SelectItem>
                              <SelectItem value="Supply">Supply</SelectItem>
                              <SelectItem value="Accounting">Accounting</SelectItem>
                              <SelectItem value="Quality">Quality</SelectItem>
                              <SelectItem value="Administrative Affairs">Administrative Affairs</SelectItem>
                              <SelectItem value="IT">IT</SelectItem>
                              <SelectItem value="Planning">Planning</SelectItem>
                              <SelectItem value="Pilot">Pilot</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {shouldShowPilotRankField && (
                          <div className="space-y-2">
                            <Label htmlFor="ekstra3">Position *</Label>
                            <Select
                              value={formData.ekstra3}
                              onValueChange={(value) =>
                                setFormData((prev) => ({ ...prev, ekstra3: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select position" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Captain">Captain</SelectItem>
                                <SelectItem value="F/O">F/O</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor="tcNo">ID Number</Label>
                          <Input
                            id="tcNo"
                            name="tcNo"
                            value={formData.tcNo}
                            onChange={handleInputChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dogumTarihi">Date of Birth</Label>
                          <DatePicker
                            value={formData.dogumTarihi}
                            onChange={(value) => setFormData((prev) => ({ ...prev, dogumTarihi: value }))}
                            placeholder="dd.mm.yyyy"
                          />
                        </div>
                      </>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="telNo">Phone Number</Label>
                      <Input
                        id="telNo"
                        name="telNo"
                        value={formData.telNo}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  {!isPilotSettings && (
                    <div className="space-y-2">
                      <Label htmlFor="adres">Address</Label>
                      <Input
                        id="adres"
                        name="adres"
                        value={formData.adres}
                        onChange={handleInputChange}
                      />
                    </div>
                  )}
                </div>

                {!isPilotSettings && <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Family Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="anneAdi">Mother&apos;s Name</Label>
                      <Input
                        id="anneAdi"
                        name="anneAdi"
                        value={formData.anneAdi}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="babaAdi">Father&apos;s Name</Label>
                      <Input
                        id="babaAdi"
                        name="babaAdi"
                        value={formData.babaAdi}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="medeniDurum">Marital Status</Label>
                      <Select
                        value={formData.medeniDurum}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, medeniDurum: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select marital status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Single">Single</SelectItem>
                          <SelectItem value="Married">Married</SelectItem>
                          <SelectItem value="Divorced">Divorced</SelectItem>
                          <SelectItem value="Widowed">Widowed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cocuk">Number of Children</Label>
                      <Input
                        id="cocuk"
                        name="cocuk"
                        type="number"
                        min="0"
                        value={formData.cocuk}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="kanGrubu">Blood Type</Label>
                      <Select
                        value={formData.kanGrubu}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, kanGrubu: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select blood type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A+">A+</SelectItem>
                          <SelectItem value="A-">A-</SelectItem>
                          <SelectItem value="B+">B+</SelectItem>
                          <SelectItem value="B-">B-</SelectItem>
                          <SelectItem value="AB+">AB+</SelectItem>
                          <SelectItem value="AB-">AB-</SelectItem>
                          <SelectItem value="0+">0+</SelectItem>
                          <SelectItem value="0-">0-</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="egitimDurum">Education Level</Label>
                      <Input
                        id="egitimDurum"
                        name="egitimDurum"
                        value={formData.egitimDurum}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>}

                {!isPilotSettings && <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Emergency Contact</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="acilIletisim">Emergency Contact Person</Label>
                      <Input
                        id="acilIletisim"
                        name="acilIletisim"
                        value={formData.acilIletisim}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="acilIletisimTel">Emergency Contact Phone</Label>
                      <Input
                        id="acilIletisimTel"
                        name="acilIletisimTel"
                        value={formData.acilIletisimTel}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>}

                {!isPilotSettings && <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Employment Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sgkSicilNo">Social Security Number</Label>
                      <Input
                        id="sgkSicilNo"
                        name="sgkSicilNo"
                        value={formData.sgkSicilNo}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bankaAdi">Bank Name</Label>
                      <Input
                        id="bankaAdi"
                        name="bankaAdi"
                        value={formData.bankaAdi}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="iban">IBAN</Label>
                      <Input
                        id="iban"
                        name="iban"
                        value={formData.iban}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="iseGirisTarihi">Hire Date</Label>
                      <DatePicker
                        value={formData.iseGirisTarihi}
                        onChange={(value) => setFormData((prev) => ({ ...prev, iseGirisTarihi: value }))}
                        placeholder="dd.mm.yyyy"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="istenCikisTarihi">Termination Date</Label>
                      <DatePicker
                        value={formData.istenCikisTarihi}
                        onChange={(value) => setFormData((prev) => ({ ...prev, istenCikisTarihi: value }))}
                        placeholder="dd.mm.yyyy"
                      />
                    </div>
                  </div>
                </div>}

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (isEditMode ? "Updating..." : "Adding...") : "Save"}
                  </Button>
                </div>
              </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
        </div>
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
                {activeColumns.map((column) => (
                  <TableHead 
                    key={column.key}
                    className="font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:bg-slate-200 select-none border-r border-gray-300 last:border-r-0"
                    onClick={() => handleSort(column.sortKey || null)}
                  >
                    <div className="flex items-center gap-1">
                      {column.label}
                      {column.sortKey && getSortIcon(column.sortKey)}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-10 border-r-0"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={activeColumns.length + 1} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : listError && calisanlar.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={activeColumns.length + 1}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Liste yüklenemedi. Üstteki uyarıdan yeniden deneyebilirsiniz.
                  </TableCell>
                </TableRow>
              ) : paginatedCalisanlar.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeColumns.length + 1} className="text-center py-8 text-muted-foreground">
                    No employees found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCalisanlar.map((calisan) => (
                  <TableRow key={calisan.id} className="hover:bg-slate-50 border-b border-gray-300">
                    {isPilotSettings ? (
                      <>
                        <TableCell className="whitespace-nowrap border-r border-gray-200">
                          {calisan.isim} {calisan.soyisim}
                        </TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.telNo || "-"}</TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.email}</TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.ekstra3 || "-"}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="whitespace-nowrap border-r border-gray-200">
                          {calisan.isim} {calisan.soyisim}
                        </TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.departman || "-"}</TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.tcNo || "-"}</TableCell>
                        <TableCell className="border-r border-gray-200">{formatDate(calisan.dogumTarihi)}</TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.telNo || "-"}</TableCell>
                        <TableCell className="max-w-xs truncate border-r border-gray-200">{calisan.adres || "-"}</TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.anneAdi || "-"}</TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.babaAdi || "-"}</TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.medeniDurum || "-"}</TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.cocuk ?? "-"}</TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.kanGrubu || "-"}</TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.email}</TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.egitimDurum || "-"}</TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.acilIletisim || "-"}</TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.acilIletisimTel || "-"}</TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.sgkSicilNo || "-"}</TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.bankaAdi || "-"}</TableCell>
                        <TableCell className="border-r border-gray-200">{calisan.iban || "-"}</TableCell>
                        <TableCell className="border-r border-gray-200">{formatDate(calisan.iseGirisTarihi)}</TableCell>
                        <TableCell className="border-r border-gray-200">{formatDate(calisan.istenCikisTarihi)}</TableCell>
                      </>
                    )}
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setSelectedCalisan(calisan)
                          setActionDialogOpen(true)
                        }}
                      >
                        <IconDotsVertical className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
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

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Action</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Choose the action you want to perform for this user
            </p>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                if (selectedCalisan) {
                  setFormData({
                    isim: selectedCalisan.isim || "",
                    soyisim: selectedCalisan.soyisim || "",
                    departman: selectedCalisan.departman || "",
                    tcNo: selectedCalisan.tcNo || "",
                    dogumTarihi: isoToTurkeyFormat(selectedCalisan.dogumTarihi),
                    telNo: selectedCalisan.telNo || "",
                    adres: selectedCalisan.adres || "",
                    anneAdi: selectedCalisan.anneAdi || "",
                    babaAdi: selectedCalisan.babaAdi || "",
                    medeniDurum: selectedCalisan.medeniDurum || "",
                    cocuk: String(selectedCalisan.cocuk || ""),
                    kanGrubu: selectedCalisan.kanGrubu || "",
                    email: selectedCalisan.email || "",
                    password: "",
                    egitimDurum: selectedCalisan.egitimDurum || "",
                    acilIletisim: selectedCalisan.acilIletisim || "",
                    acilIletisimTel: selectedCalisan.acilIletisimTel || "",
                    sgkSicilNo: selectedCalisan.sgkSicilNo || "",
                    bankaAdi: selectedCalisan.bankaAdi || "",
                    iban: selectedCalisan.iban || "",
                    iseGirisTarihi: isoToTurkeyFormat(selectedCalisan.iseGirisTarihi),
                    istenCikisTarihi: isoToTurkeyFormat(selectedCalisan.istenCikisTarihi),
                    ekstra1: selectedCalisan.ekstra1 || "",
                    ekstra2: selectedCalisan.ekstra2 || "",
                    ekstra3: selectedCalisan.ekstra3 || "",
                  })
                  setIsEditMode(true)
                  setActionDialogOpen(false)
                  setDialogOpen(true)
                }
              }}
            >
              <IconPencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            
            <Button
              variant="outline"
              className="w-full border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600"
              onClick={async () => {
                if (selectedCalisan && confirm(`Are you sure you want to delete ${selectedCalisan.isim} ${selectedCalisan.soyisim}?`)) {
                  try {
                    const response = await fetch(`/api/calisanlar/${selectedCalisan.id}`, {
                      method: "DELETE",
                    })
                    if (response.ok) {
                      void fetchCalisanlar("refresh")
                      setActionDialogOpen(false)
                      setSelectedCalisan(null)
                    } else {
                      alert("Failed to delete user")
                    }
                  } catch (error) {
                    console.error("Delete error:", error)
                    alert("An error occurred")
                  }
                }
              }}
            >
              <IconTrash className="mr-2 h-4 w-4" />
              Delete User
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
