"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, HelpCircle, PlusCircle } from "lucide-react"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { cn } from "@/lib/utils"

type RevisionRow = {
  id: number | null
  revisionNumber: number
  revisionDate: string | null
  title: string
  description: string | null
  items: { id: number; label: string; sortOrder: number; isRequired: boolean }[]
  synthetic: boolean
  missingSnapshot?: boolean
}

type RevisionsPayload = {
  checklist: {
    id: number
    title: string
    checklistNumber: string
    initialRevisionNumber: number
    initialRevisionDate: string
    latestRevisionNumber: number
    latestRevisionDate: string
  }
  revisions: RevisionRow[]
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

function formatRevisionLine(rev: number, date: string | null): string {
  const d = date && date !== "—" ? date : "—"
  return `Revision #${rev} | ${d}`
}

export function AuditChecklistRevisionsClient({ checklistId }: { checklistId: number }) {
  const router = useRouter()
  const [data, setData] = React.useState<RevisionsPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [creatingNext, setCreatingNext] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/audit-checklists/${checklistId}/revisions`, {
        cache: "no-store",
      })
      const raw = await parseJson(res)
      if (!res.ok || !raw || typeof raw !== "object") {
        toast.error("Revizyonlar yüklenemedi.")
        setData(null)
        return
      }
      setData(raw as RevisionsPayload)
    } catch {
      toast.error("Revizyonlar yüklenemedi.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [checklistId])

  React.useEffect(() => {
    void load()
  }, [load])

  const title = data?.checklist.title ?? "Checklist"

  const createNextRevision = React.useCallback(async () => {
    setCreatingNext(true)
    try {
      const res = await fetch(`/api/audit-checklists/${checklistId}/revisions/create-next`, {
        method: "POST",
      })
      const raw = await parseJson(res)
      if (!res.ok) {
        const msg =
          raw && typeof raw === "object" && "error" in raw && typeof raw.error === "string"
            ? raw.error
            : "Yeni revizyon oluşturulamadı."
        toast.error(msg)
        return
      }
      const rev =
        raw && typeof raw === "object" && "revisionNumber" in raw
          ? Number((raw as { revisionNumber: unknown }).revisionNumber)
          : NaN
      if (!Number.isInteger(rev)) {
        toast.error("Yanıt geçersiz.")
        return
      }
      const count =
        raw && typeof raw === "object" && "itemCount" in raw
          ? Number((raw as { itemCount: unknown }).itemCount)
          : 0
      toast.success(
        `Revizyon #${rev} oluşturuldu${count > 0 ? ` · ${count} madde kopyalandı` : ""}.`
      )
      await load()
      router.push(`/compliance/checklists/${checklistId}/revisions/${rev}`)
    } catch {
      toast.error("Bağlantı hatası.")
    } finally {
      setCreatingNext(false)
    }
  }, [checklistId, load, router])

  return (
    <TooltipProvider>
      <SetWorkspacePageTitle title={`${title} — Revizyonlar`} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:pr-4">
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
                  <BreadcrumbLink asChild>
                    <Link href={`/compliance/checklists/${checklistId}`} className="max-w-[160px] truncate">
                      {loading ? "…" : title}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Revizyonlar</BreadcrumbPage>
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
                {loading ? "Yükleniyor…" : title}
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
                  Her satır kayıtlı bir revizyon anlık görüntüsüdür. Builder’da «Kaydet» revizyon
                  numarasını değiştirmez (ara verirken güvenle kullanın). Yeni numara için burada
                  «Yeni revizyon» kullanın.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          {!loading && data ? (
            <Button
              type="button"
              size="sm"
              className="shrink-0 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              disabled={creatingNext}
              onClick={() => void createNextRevision()}
            >
              <PlusCircle className="size-4" />
              {creatingNext ? "Oluşturuluyor…" : "Yeni revizyon"}
            </Button>
          ) : null}
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Yükleniyor…</p>
        ) : !data ? (
          <p className="text-muted-foreground text-sm">Kayıt bulunamadı.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              Rev. #{data.checklist.initialRevisionNumber}–#{data.checklist.latestRevisionNumber}{" "}
              arası {data.revisions.length} kayıt
              {data.revisions.some((r) => r.missingSnapshot)
                ? " · Sarı uyarılı satırlarda arşiv anlık görüntüsü yok."
                : ""}
            </p>
            <ul className="flex flex-col gap-2">
              {data.revisions.map((r) => (
                <li
                  key={`${r.revisionNumber}-${r.id ?? "syn"}`}
                  className={cn(
                    "bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-medium">
                      {formatRevisionLine(r.revisionNumber, r.revisionDate)}
                    </p>
                    {r.description?.trim() ? (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                        {r.description.trim()}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground mt-1 text-xs">
                      {r.missingSnapshot
                        ? "Arşiv anlık görüntüsü yok"
                        : `${r.items.length} madde`}
                      {r.synthetic && !r.missingSnapshot
                        ? " · Canlı özet (kayıtlı arşiv satırı yoksa)."
                        : ""}
                    </p>
                    {r.missingSnapshot ? (
                      <p className="text-amber-800 dark:text-amber-200 mt-1 text-xs font-medium">
                        Bu numara listede; içerik veritabanında saklanmamış.
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    onClick={() =>
                      router.push(
                        `/compliance/checklists/${checklistId}/revisions/${r.revisionNumber}`
                      )
                    }
                  >
                    Checklist Builder →
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
