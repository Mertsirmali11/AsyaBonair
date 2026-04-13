"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconArchive,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react"
import { formatDateTimeIstanbul } from "@/lib/date-format"
import { DOCUMENT_ACCEPT_HTML } from "@/lib/allowed-document-uploads"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ManualRow = {
  id: number
  title: string
  slug: string
  createdAt: string
  updatedAt: string
  department: string | null
  revision: number
  isCurrent: boolean
  createdBy: number | null
  creator: {
    isim: string | null
    soyisim: string | null
    email: string
  } | null
}

function formatUploaderLabel(m: ManualRow): string {
  const c = m.creator
  if (!c) return "—"
  const name = `${c.isim ?? ""} ${c.soyisim ?? ""}`.trim()
  if (name) return `${name} (${c.email})`
  return c.email
}

function matchesManualSearch(m: ManualRow, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const up = formatUploaderLabel(m).toLowerCase()
  return (
    m.title.toLowerCase().includes(s) ||
    m.slug.toLowerCase().includes(s) ||
    (m.department ?? "").toLowerCase().includes(s) ||
    `rev.${m.revision}`.includes(s) ||
    String(m.revision).includes(s) ||
    up.includes(s)
  )
}

export function ConfigManualsClient() {
  const [items, setItems] = React.useState<ManualRow[]>([])
  const [historicItems, setHistoricItems] = React.useState<ManualRow[]>([])
  const [viewerIsAdminDepartment, setViewerIsAdminDepartment] =
    React.useState(false)
  const [canManageManuals, setCanManageManuals] = React.useState(false)
  const [departmentOptions, setDepartmentOptions] = React.useState<string[]>(
    []
  )
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")

  const [addOpen, setAddOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [department, setDepartment] = React.useState<string>("")
  const [departmentTab, setDepartmentTab] = React.useState<"list" | "custom">("list")
  const [customDepartment, setCustomDepartment] = React.useState("")
  const [uploadMode, setUploadMode] = React.useState<"new" | "revision">("new")
  const [supersedesId, setSupersedesId] = React.useState<string>("")
  const [revisionInput, setRevisionInput] = React.useState("0")
  const [file, setFile] = React.useState<File | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<number | null>(null)
  const [archivingId, setArchivingId] = React.useState<number | null>(null)
  const [banner, setBanner] = React.useState<{
    type: "ok" | "err"
    text: string
  } | null>(null)

  React.useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner(null), 5000)
    return () => window.clearTimeout(t)
  }, [banner])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/manuals", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        manuals?: ManualRow[]
        historicManuals?: ManualRow[]
        viewerIsAdminDepartment?: boolean
        canManageManuals?: boolean
        departmentOptions?: string[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "Could not load list")
      const list = Array.isArray(data.manuals) ? data.manuals : []
      setItems(
        list.map((m) => ({
          ...m,
          revision: m.revision ?? 0,
          isCurrent: m.isCurrent ?? true,
          createdBy: m.createdBy ?? null,
          creator: m.creator ?? null,
        }))
      )
      setHistoricItems(
        Array.isArray(data.historicManuals)
          ? data.historicManuals.map((m) => ({
              ...m,
              revision: m.revision ?? 0,
              isCurrent: m.isCurrent ?? false,
              createdBy: m.createdBy ?? null,
              creator: m.creator ?? null,
            }))
          : []
      )
      setViewerIsAdminDepartment(!!data.viewerIsAdminDepartment)
      setCanManageManuals(!!data.canManageManuals)
      setDepartmentOptions(
        Array.isArray(data.departmentOptions) ? data.departmentOptions : []
      )
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not load list",
      })
      setItems([])
      setHistoricItems([])
      setDepartmentOptions([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const resetAddForm = () => {
    setTitle("")
    setDepartment("")
    setDepartmentTab("list")
    setCustomDepartment("")
    setUploadMode("new")
    setSupersedesId("")
    setRevisionInput("0")
    setFile(null)
  }

  const revisionNumberValid = React.useMemo(() => {
    const n = Number.parseInt(revisionInput.trim(), 10)
    return Number.isFinite(n) && n >= 0 && n <= 999999
  }, [revisionInput])

  const departmentChoiceValid = React.useMemo(() => {
    if (departmentTab === "list") {
      return Boolean(department.trim()) && departmentOptions.length > 0
    }
    const t = customDepartment.trim()
    return t.length >= 1 && t.length <= 100
  }, [departmentTab, department, customDepartment, departmentOptions.length])

  const submit = async () => {
    const t = title.trim()
    const deptValue =
      departmentTab === "list" ? department.trim() : customDepartment.trim()
    if (!t || !file || !deptValue || !departmentChoiceValid) {
      setBanner({
        type: "err",
        text: "Title, owning department, and a file (PDF, Word, Excel, or PowerPoint) are required.",
      })
      return
    }
    if (!revisionNumberValid) {
      setBanner({
        type: "err",
        text: "Enter a revision number between 0 and 999999 (whole number).",
      })
      return
    }
    if (uploadMode === "revision") {
      const sid = Number.parseInt(supersedesId, 10)
      if (!Number.isFinite(sid) || sid < 1) {
        setBanner({
          type: "err",
          text: "Pick the current manual this upload replaces.",
        })
        return
      }
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("title", t)
      fd.append("department", deptValue)
      fd.append("departmentMode", departmentTab)
      fd.append("revision", revisionInput.trim())
      fd.append("file", file)
      if (uploadMode === "revision") {
        fd.append("supersedesId", supersedesId)
      }
      const res = await fetch("/api/manuals", { method: "POST", body: fd })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Upload failed")
      setBanner({
        type: "ok",
        text:
          uploadMode === "revision"
            ? "New revision saved. Older revisions appear only to users in the Admin department."
            : "Manual saved. It can be selected in Bonair AI chat.",
      })
      resetAddForm()
      setAddOpen(false)
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Upload failed",
      })
    } finally {
      setUploading(false)
    }
  }

  const archiveCurrent = async (id: number) => {
    if (
      !confirm(
        "Move this current revision to Previous revisions? If this series has only one row, it will disappear from the active list and Bonair AI until you upload a new revision. If there are older revisions in the same series, the highest of those becomes current again."
      )
    ) {
      return
    }
    setArchivingId(id)
    try {
      const res = await fetch(`/api/manuals/${id}/archive-current`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Could not archive")
      setBanner({
        type: "ok",
        text: viewerIsAdminDepartment
          ? "Revision archived — check Previous revisions below."
          : "Revision archived. It no longer appears in the active list; only Admin department users see it under Previous revisions.",
      })
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not archive",
      })
    } finally {
      setArchivingId(null)
    }
  }

  const remove = async (id: number) => {
    if (!confirm("Delete this manual?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/manuals/${id}`, { method: "DELETE" })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Could not delete")
      setBanner({ type: "ok", text: "Manual deleted." })
      await load()
    } catch (e) {
      setBanner({
        type: "err",
        text: e instanceof Error ? e.message : "Could not delete",
      })
    } finally {
      setDeletingId(null)
    }
  }

  const filteredCurrent = React.useMemo(
    () => items.filter((m) => matchesManualSearch(m, search)),
    [items, search]
  )
  const filteredHistoric = React.useMemo(
    () => historicItems.filter((m) => matchesManualSearch(m, search)),
    [historicItems, search]
  )

  const revisionParentOptions = items.filter((m) => m.isCurrent !== false)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {banner && (
        <div
          role="status"
          className={
            banner.type === "ok"
              ? "rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground"
              : "rounded-lg border border-destructive/40 bg-background px-4 py-3 text-sm text-destructive"
          }
        >
          {banner.text}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md">
          <Label htmlFor="manual-search" className="text-muted-foreground">
            Search manuals
          </Label>
          <div className="flex gap-2">
            <Input
              id="manual-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Title, department, uploader, slug, revision…"
              className="flex-1"
            />
            <Button type="button" variant="secondary" className="shrink-0 gap-1.5">
              <IconSearch className="size-4" />
              Search
            </Button>
          </div>
        </div>
        {canManageManuals ? (
          <Button
            type="button"
            className="shrink-0 gap-2 sm:self-end"
            onClick={() => {
              resetAddForm()
              setAddOpen(true)
            }}
          >
            <IconPlus className="size-4" />
            Add Manual
          </Button>
        ) : null}
      </div>
      {!loading && !canManageManuals ? (
        <p className="text-muted-foreground text-sm">
          Yükleme yalnızca <strong>Quality</strong> veya <strong>Human Resources</strong>{" "}
          departmanı hesapları içindir; yetkiniz varsa sağda (geniş ekranda) veya arama
          alanının hemen altında <strong>Add Manual</strong> düğmesi görünür.
        </p>
      ) : null}

      <Card className="border-muted bg-muted/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revizyon takibi nasıl çalışır?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0 text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">Güncel sürüm:</strong> Listede her kitap
            için yalnızca girdiğiniz revizyon numarasıyla kayıtlı güncel dosya görünür
            (Bonair AI da bunu kullanır).
          </p>
          <p>
            <strong className="text-foreground">Yeni revizyon:</strong> Add Manual → New
            revision of existing → güncel satırı seçin → yeni Revision number ve dosya →
            Save. Önceki güncel satır arşivlenir.
          </p>
          <p>
            <strong className="text-foreground">Listeden arşiv:</strong> Güncel satırda
            klasör (Move to previous) simgesi: satırı arşivler. Seride başka revizyon
            varsa en yüksek olan tekrar güncel olur; tek revizyon varsa kayıt yalnızca
            Admin’in Previous revisions listesinde kalır, Bonair AI listeden düşer.
          </p>
          <p>
            <strong className="text-foreground">Eski revizyonlar:</strong> Yalnızca
            oturumdaki <strong className="text-foreground">Department = Admin</strong>{" "}
            olan kullanıcılar sayfanın altındaki Previous revisions listesini görür.
            Atama:{" "}
            <Link
              href="/configurations"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Configurations → User settings
            </Link>{" "}
            → çalışanı düzenle → Department: <strong className="text-foreground">Admin</strong>{" "}
            (HR / Quality / Admin). Ayrı bir &quot;admin listesi&quot; ekranı yok; User
            settings tablosunda arama ile bulunur.
          </p>
          <p>
            <strong className="text-foreground">Kim yükledi:</strong> Her satırda
            yükleyen çalışanın adı ve e-postası gösterilir (veritabanında kalıcı).
          </p>
          <p>
            <strong className="text-foreground">Departman:</strong> Owning department
            için iki yol vardır: <strong className="text-foreground">Standard list</strong>{" "}
            (User Management ile aynı kurum listesi) veya{" "}
            <strong className="text-foreground">Custom label</strong> (listedeki olmayan
            birim / proje adı, en fazla 100 karakter).
          </p>
        </CardContent>
      </Card>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) resetAddForm()
        }}
      >
        <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add manual</DialogTitle>
            <DialogDescription>
              Text is extracted from PDF or Office files for grounded Q&amp;A in Bonair
              AI. You set the revision number yourself (e.g. 29). Owning department: pick
              the standard list or enter a custom label. Superseded files are listed only
              for the Admin department.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="space-y-2">
              <Label>Upload type</Label>
              <Select
                value={uploadMode}
                onValueChange={(v) => {
                  setUploadMode(v as "new" | "revision")
                  setSupersedesId("")
                }}
                disabled={uploading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New manual</SelectItem>
                  <SelectItem value="revision">New revision of existing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {uploadMode === "revision" ? (
              <div className="space-y-2">
                <Label htmlFor="manual-supersedes">Current manual to supersede</Label>
                <Select
                  value={supersedesId || undefined}
                  onValueChange={setSupersedesId}
                  disabled={uploading || revisionParentOptions.length === 0}
                >
                  <SelectTrigger id="manual-supersedes" className="w-full">
                    <SelectValue placeholder="Select current manual…" />
                  </SelectTrigger>
                  <SelectContent>
                    {revisionParentOptions.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.title} (Rev. {m.revision ?? 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {revisionParentOptions.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Upload a new manual first; then you can add revisions.
                  </p>
                ) : null}
                {uploadMode === "revision" && supersedesId ? (
                  <p className="text-muted-foreground text-xs">
                    Current row is Rev.{" "}
                    {revisionParentOptions.find((m) => String(m.id) === supersedesId)
                      ?.revision ?? "—"}
                    . Enter the new revision number below.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="modal-manual-title">Manual title</Label>
              <Input
                id="modal-manual-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Compliance Monitoring Manual"
                disabled={uploading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-manual-revision">Revision number</Label>
              <Input
                id="modal-manual-revision"
                type="number"
                min={1}
                max={999999}
                step={1}
                inputMode="numeric"
                value={revisionInput}
                onChange={(e) => setRevisionInput(e.target.value)}
                placeholder="e.g. 29"
                disabled={uploading}
              />
              <p className="text-muted-foreground text-xs">
                Same series cannot reuse a revision number. For a new manual, this is
                usually 1 unless you match your document numbering.
              </p>
            </div>
            <div className="space-y-3">
              <Label>Owning department</Label>
              <Tabs
                value={departmentTab}
                onValueChange={(v) => {
                  const next = v as "list" | "custom"
                  setDepartmentTab(next)
                  if (next === "list") setCustomDepartment("")
                  else setDepartment("")
                }}
              >
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="list" disabled={uploading}>
                    Standard list
                  </TabsTrigger>
                  <TabsTrigger value="custom" disabled={uploading}>
                    Custom label
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="list" className="mt-2 space-y-2">
                  <p className="text-muted-foreground text-xs">
                    Same options as User Management (fixed organization departments).
                  </p>
                  <Select
                    value={department || undefined}
                    onValueChange={setDepartment}
                    disabled={uploading || departmentOptions.length === 0}
                  >
                    <SelectTrigger id="modal-manual-department" className="w-full">
                      <SelectValue placeholder="Select department…" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentOptions.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TabsContent>
                <TabsContent value="custom" className="mt-2 space-y-2">
                  <p className="text-muted-foreground text-xs">
                    Use when the owning unit is not in the list (e.g. project name). Max
                    100 characters.
                  </p>
                  <Input
                    id="modal-manual-department-custom"
                    value={customDepartment}
                    onChange={(e) => setCustomDepartment(e.target.value)}
                    placeholder="e.g. SMS Working Group"
                    disabled={uploading}
                    maxLength={100}
                  />
                </TabsContent>
              </Tabs>
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-manual-file">File (PDF, Word, Excel, PowerPoint)</Label>
              <Input
                id="modal-manual-file"
                type="file"
                accept={DOCUMENT_ACCEPT_HTML}
                disabled={uploading}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => {
                setAddOpen(false)
                resetAddForm()
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                uploading ||
                !title.trim() ||
                !departmentChoiceValid ||
                !revisionNumberValid ||
                !file ||
                (uploadMode === "revision" &&
                  (!supersedesId || revisionParentOptions.length === 0))
              }
              className="gap-2"
              onClick={() => void submit()}
            >
              <IconUpload className="size-4" />
              {uploading ? "Uploading…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded manuals</CardTitle>
          <CardDescription>
            Current revisions are visible to everyone. Only current records appear in
            the Bonair AI manual picker. Use{" "}
            <span className="font-medium text-foreground">Move to previous</span> to
            archive the current row (works for a single revision too; multi-revision
            series then promotes the next-highest revision).
            {viewerIsAdminDepartment
              ? " Superseded revisions are listed below (Admin department only)."
              : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredCurrent.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {items.length === 0
                ? "No manuals yet."
                : "No manuals match your search."}
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {filteredCurrent.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{m.title}</p>
                    <p className="text-muted-foreground text-xs">
                      Rev. {m.revision ?? 0}
                      {m.department ? ` · ${m.department}` : ""}
                      {" · "}
                      Uploaded by {formatUploaderLabel(m)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatDateTimeIstanbul(m.createdAt)} (uploaded) ·{" "}
                      {formatDateTimeIstanbul(m.updatedAt)} (updated) · {m.slug}
                    </p>
                  </div>
                  {canManageManuals ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:bg-muted hover:text-foreground"
                        disabled={archivingId === m.id || deletingId === m.id}
                        onClick={() => void archiveCurrent(m.id)}
                        aria-label="Move to previous revisions"
                        title="Move to previous revisions"
                      >
                        <IconArchive className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={deletingId === m.id || archivingId === m.id}
                        onClick={() => void remove(m.id)}
                        aria-label="Delete"
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {!viewerIsAdminDepartment ? (
        <Card className="border-border/80 bg-muted/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Previous revisions neden görünmüyor?
            </CardTitle>
            <CardDescription>
              Arşiv bölümü yalnızca kullanıcı kaydınızda departmanı{" "}
              <span className="font-medium text-foreground">Admin</span> olan hesaplar
              içindir (ör. Quality, Pilot görmez).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">Adminleri nerede seçiyoruz?</strong>{" "}
              Ayrı bir rol ekranı yok:{" "}
              <Link
                href="/configurations"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Configurations → User settings
              </Link>{" "}
              sayfasında bir çalışanı açıp{" "}
              <strong className="text-foreground">Department</strong> alanından{" "}
              <strong className="text-foreground">Admin</strong> seçilir ve kaydedilir.
              Bu sayfaya HR, Quality ve Admin departmanındaki kullanıcılar erişebilir.
            </p>
            <p>
              <strong className="text-foreground">Admin listesini nerede görürüm?</strong>{" "}
              Özel liste yok; User settings tablosunda çalışanları arayıp departmanı
              Admin olanları kendiniz süzebilirsiniz. Arşivi siz görecekseniz, kendi
              hesabınızın departmanını Admin yapmanız gerekir (iş kurallarınıza göre).
            </p>
          </CardContent>
        </Card>
      ) : null}

      {viewerIsAdminDepartment ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Previous revisions</CardTitle>
            <CardDescription>
              Admin department only: archived superseded files. Downloading full text
              via the API is also restricted the same way.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-12 w-full" />
            ) : filteredHistoric.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {historicItems.length === 0
                  ? "No superseded revisions."
                  : "No archived manuals match your search."}
              </p>
            ) : (
              <ul className="divide-y rounded-md border border-dashed">
                {filteredHistoric.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 bg-muted/30 p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-muted-foreground">{m.title}</p>
                      <p className="text-muted-foreground text-xs">
                        Rev. {m.revision ?? 0}
                        {m.department ? ` · ${m.department}` : ""}
                        {" · "}
                        Uploaded by {formatUploaderLabel(m)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatDateTimeIstanbul(m.createdAt)} (uploaded) ·{" "}
                        {formatDateTimeIstanbul(m.updatedAt)} (updated) · {m.slug}
                      </p>
                    </div>
                    {canManageManuals ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={deletingId === m.id}
                        onClick={() => void remove(m.id)}
                        aria-label="Delete archived revision"
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
