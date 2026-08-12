"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LayoutGrid, Loader2, Plus, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { cn } from "@/lib/utils"

type PlanRow = {
  id: number
  name: string
  description: string | null
  color: string | null
  role: "OWNER" | "MANAGER" | "MEMBER"
  memberCount: number
  taskCount: number
}

const PLAN_COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"]

async function parseJson(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return null
  }
}

export function PlannerPlansClient() {
  const router = useRouter()
  const [plans, setPlans] = React.useState<PlanRow[]>([])
  const [loading, setLoading] = React.useState(true)

  const [createOpen, setCreateOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [color, setColor] = React.useState(PLAN_COLORS[0])
  const [creating, setCreating] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/planner/plans", { cache: "no-store" })
      const data = await parseJson(res)
      setPlans(res.ok && Array.isArray(data) ? (data as PlanRow[]) : [])
    } catch {
      toast.error("Planlar yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setName("")
    setDescription("")
    setColor(PLAN_COLORS[0])
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    if (!name.trim()) {
      toast.error("Plan adı zorunludur.")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/planner/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, color }),
      })
      const data = (await parseJson(res)) as { id?: number; error?: string } | null
      if (!res.ok || !data?.id) throw new Error(data?.error || "Plan oluşturulamadı.")
      toast.success("Plan oluşturuldu.")
      setCreateOpen(false)
      router.push(`/planner/${data.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Plan oluşturulamadı.")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <SetWorkspacePageTitle title="Planner" />
      <Breadcrumb className="text-xs sm:text-sm">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard">Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbPage>Planner</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <LayoutGrid className="size-5 text-blue-600" />
          Planner
        </h1>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-1.5 size-4" />
          New Plan
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Yükleniyor…</p>
      ) : plans.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <LayoutGrid className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">
            Henüz bir plana üye değilsiniz. Örn. Compliance Monitoring, Safety Management, CAMO Follow-up gibi bir plan oluşturun.
          </p>
          <Button type="button" onClick={openCreate}>
            <Plus className="mr-1.5 size-4" />
            New Plan
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <Link
              key={p.id}
              href={`/planner/${p.id}`}
              className="bg-card hover:border-primary/50 flex flex-col gap-2 rounded-lg border p-4 shadow-sm transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: p.color ?? "#64748b" }} />
                <h2 className="min-w-0 flex-1 truncate font-semibold">{p.name}</h2>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    p.role === "OWNER"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                      : p.role === "MANAGER"
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  )}
                >
                  {p.role}
                </span>
              </div>
              {p.description && <p className="text-muted-foreground line-clamp-2 text-sm">{p.description}</p>}
              <div className="text-muted-foreground mt-auto flex items-center gap-3 pt-2 text-xs">
                <span className="flex items-center gap-1">
                  <Users className="size-3.5" />
                  {p.memberCount}
                </span>
                <span>{p.taskCount} task</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(o) => !creating && setCreateOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>Plan Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="örn. Compliance Monitoring" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[80px]" />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {PLAN_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn("size-7 rounded-full border-2", color === c ? "border-foreground" : "border-transparent")}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Vazgeç
            </Button>
            <Button type="button" disabled={creating} onClick={() => void submitCreate()}>
              {creating ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
