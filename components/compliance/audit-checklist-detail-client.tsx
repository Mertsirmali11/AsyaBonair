"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, HelpCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { defaultChecklistNumber, revisionCell } from "@/lib/audit-checklist-helpers"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import type { AuditChecklistListRow } from "@/components/compliance/audit-checklists-client"

type ChecklistDetail = AuditChecklistListRow & {
  items: { id: number; label: string; sortOrder: number; isRequired: boolean; isHeading?: boolean; reference?: string | null; section?: string | null }[]
}

async function parseJson(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return null
  }
}

export function AuditChecklistDetailClient({ checklistId }: { checklistId: number }) {
  const router = useRouter()
  const [row, setRow] = React.useState<ChecklistDetail | null>(null)
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/audit-checklists/${checklistId}`, { cache: "no-store" })
      const data = await parseJson(res)
      if (!res.ok) {
        toast.error("Checklist bulunamadı.")
        setRow(null)
        return
      }
      setRow(data as ChecklistDetail)
    } catch {
      toast.error("Yüklenemedi.")
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [checklistId])

  React.useEffect(() => {
    void load()
  }, [load])

  const num = row?.checklistNumber ?? (row ? defaultChecklistNumber(row.id) : "")

  const openEditOnList = () => {
    sessionStorage.setItem("openChecklistEdit", String(checklistId))
    router.push("/compliance/checklists")
  }

  return (
    <TooltipProvider>
      <SetWorkspacePageTitle title={row?.title ?? "Checklist"} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Breadcrumb className="text-xs sm:text-sm">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/dashboard">Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/compliance">Compliance Monitoring</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/compliance/checklists">Checklists</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="max-w-[200px] truncate">
                    {loading ? "…" : num || "Checklist"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                title="Geri"
                asChild
              >
                <Link href="/compliance/checklists">
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
              <h1 className="text-2xl font-semibold tracking-tight">
                {loading ? "Yükleniyor…" : row?.title ?? "—"}
              </h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md"
                    aria-label="Bilgi"
                  >
                    <HelpCircle className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs" side="bottom">
                  Maddeleri ve meta verileri düzenlemek için «Düzenle» ile listeye geçip formu
                  açın.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={openEditOnList}>
              Düzenle
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Yükleniyor…</p>
        ) : !row ? (
          <p className="text-muted-foreground text-sm">Kayıt bulunamadı.</p>
        ) : (
          <>
            <div className="bg-muted/40 grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs font-medium">Checklist Number</p>
                <p className="font-mono text-sm">{num}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">Initial Revision</p>
                <p className="font-mono text-sm">
                  {revisionCell(row.initialRevisionNumber, row.initialRevisionDate)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">Latest Revision</p>
                <p className="font-mono text-sm">
                  {revisionCell(row.latestRevisionNumber, row.latestRevisionDate)}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-muted-foreground text-xs font-medium">Açıklama</p>
                <p className="text-sm whitespace-pre-wrap">{row.description?.trim() || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">Durum</p>
                <p className="text-sm">{row.isActive ? "Aktif" : "Pasif"}</p>
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-lg font-semibold">
                Maddeler ({row.items.filter((it) => !it.isHeading).length} soru
                {row.items.some((it) => it.isHeading)
                  ? `, ${row.items.filter((it) => it.isHeading).length} başlık`
                  : ""})
              </h2>
              <div className="bg-card overflow-hidden rounded-lg border">
                <ScrollArea className="h-[min(50vh,480px)]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-14">#</TableHead>
                        <TableHead>Madde</TableHead>
                        <TableHead className="w-48">Referans</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {row.items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-muted-foreground h-24 text-center">
                            Madde yok.
                          </TableCell>
                        </TableRow>
                      ) : (() => {
                        let qNum = 0
                        return row.items.map((it) => {
                          if (it.isHeading) {
                            return (
                              <TableRow key={it.id} className="bg-amber-50/60 hover:bg-amber-50/80 dark:bg-amber-950/20 dark:hover:bg-amber-950/30">
                                <TableCell className="font-mono text-xs text-amber-600">—</TableCell>
                                <TableCell colSpan={2} className="font-semibold text-amber-800 dark:text-amber-300">
                                  {it.label}
                                </TableCell>
                              </TableRow>
                            )
                          }
                          qNum++
                          return (
                            <TableRow key={it.id}>
                              <TableCell className="text-muted-foreground font-mono text-sm">
                                {qNum}
                              </TableCell>
                              <TableCell className="text-sm">{it.label}</TableCell>
                              <TableCell className="text-muted-foreground font-mono text-xs">
                                {it.reference ?? ""}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      })()}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  )
}
