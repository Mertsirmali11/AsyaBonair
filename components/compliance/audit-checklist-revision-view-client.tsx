"use client"

import * as React from "react"
import Link from "next/link"
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
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"

type RevisionPayload = {
  checklist: { id: number; title: string; checklistNumber: string }
  revision: {
    id: number | null
    revisionNumber: number
    revisionDate: string | null
    title: string
    description: string | null
    items: { id: number; label: string; sortOrder: number; isRequired: boolean }[]
    synthetic: boolean
  }
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

export function AuditChecklistRevisionViewClient({
  checklistId,
  revisionNumber,
}: {
  checklistId: number
  revisionNumber: number
}) {
  const [data, setData] = React.useState<RevisionPayload | null>(null)
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/audit-checklists/${checklistId}/revisions/${revisionNumber}`,
        { cache: "no-store" }
      )
      const raw = await parseJson(res)
      if (!res.ok || !raw || typeof raw !== "object") {
        toast.error("Revizyon bulunamadı.")
        setData(null)
        return
      }
      setData(raw as RevisionPayload)
    } catch {
      toast.error("Yüklenemedi.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [checklistId, revisionNumber])

  React.useEffect(() => {
    void load()
  }, [load])

  const rev = data?.revision
  const displayTitle = rev?.title ?? data?.checklist.title ?? "Checklist"
  const dateStr = rev?.revisionDate && rev.revisionDate !== "—" ? rev.revisionDate : "—"

  return (
    <TooltipProvider>
      <SetWorkspacePageTitle title={`${displayTitle} — Rev. ${revisionNumber}`} />
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
                    <Link href="/compliance/checklists">Checklists</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link
                      href={`/compliance/checklists/${checklistId}/revisions`}
                      className="max-w-[140px] truncate"
                    >
                      Revizyonlar
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>#{revisionNumber}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                title="Revizyon listesi"
                asChild
              >
                <Link href={`/compliance/checklists/${checklistId}/revisions`}>
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
              <h1 className="text-2xl font-semibold tracking-tight">
                {loading ? "Yükleniyor…" : displayTitle}
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
                  Bu ekran seçilen revizyondaki kayıtlı maddeleri gösterir (salt okunur). Güncel
                  içeriği düzenlemek için checklist listesinden «Yönet» kullanın.
                </TooltipContent>
              </Tooltip>
            </div>
            {!loading && rev ? (
              <p className="text-muted-foreground font-mono text-sm">
                Revision #{rev.revisionNumber} | {dateStr}
                {rev.synthetic ? " · Özet (tam arşiv bu checklist için sonraki kayıtlarla oluşur)" : ""}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={`/compliance/checklists/${checklistId}`}>Güncel içerik</Link>
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Yükleniyor…</p>
        ) : !data?.revision ? (
          <p className="text-muted-foreground text-sm">Kayıt bulunamadı.</p>
        ) : (
          <>
            {data.revision.description?.trim() ? (
              <div className="bg-muted/40 rounded-lg border p-4">
                <p className="text-muted-foreground text-xs font-medium">Açıklama (revizyon)</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{data.revision.description.trim()}</p>
              </div>
            ) : null}
            <div>
              <h2 className="mb-2 text-lg font-semibold">
                Maddeler ({data.revision.items.length})
              </h2>
              <div className="bg-card overflow-hidden rounded-lg border">
                <ScrollArea className="h-[min(50vh,480px)]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-14">#</TableHead>
                        <TableHead>Madde</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.revision.items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-muted-foreground h-24 text-center">
                            Bu revizyonda madde yok.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.revision.items.map((it, idx) => (
                          <TableRow key={it.id}>
                            <TableCell className="text-muted-foreground font-mono text-sm">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="text-sm">{it.label}</TableCell>
                          </TableRow>
                        ))
                      )}
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
