"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, Trash2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmployeeCombobox } from "@/components/employee-combobox"
import { cn } from "@/lib/utils"

type MemberRow = { id: number; calisanId: number; name: string; departman: string | null; role: "OWNER" | "MANAGER" | "MEMBER" }

const ROLE_STYLES: Record<string, string> = {
  OWNER: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  MANAGER: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  MEMBER: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
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

export function PlannerMembersDialog({
  planId,
  canManage,
  employees,
  onClose,
}: {
  planId: number
  canManage: boolean
  employees: { id: number; label: string }[]
  onClose: () => void
}) {
  const [members, setMembers] = React.useState<MemberRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [addCalisanId, setAddCalisanId] = React.useState<number | undefined>(undefined)
  const [addRole, setAddRole] = React.useState("MEMBER")
  const [adding, setAdding] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/planner/plans/${planId}`, { cache: "no-store" })
      const data = (await parseJson(res)) as { members?: MemberRow[] } | null
      setMembers(data?.members ?? [])
    } finally {
      setLoading(false)
    }
  }, [planId])

  React.useEffect(() => {
    void load()
  }, [load])

  const addMember = async () => {
    if (!addCalisanId) return
    setAdding(true)
    try {
      const res = await fetch(`/api/planner/plans/${planId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calisanId: addCalisanId, role: addRole }),
      })
      const data = (await parseJson(res)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error || "Eklenemedi.")
      toast.success("Üye eklendi.")
      setAddCalisanId(undefined)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eklenemedi.")
    } finally {
      setAdding(false)
    }
  }

  const changeRole = async (memberId: number, role: string) => {
    try {
      const res = await fetch(`/api/planner/plans/${planId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      const data = (await parseJson(res)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error || "Güncellenemedi.")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Güncellenemedi.")
    }
  }

  const removeMember = async (memberId: number) => {
    try {
      const res = await fetch(`/api/planner/plans/${planId}/members/${memberId}`, { method: "DELETE" })
      const data = (await parseJson(res)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error || "Kaldırılamadı.")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaldırılamadı.")
    }
  }

  const availableEmployees = employees.filter((e) => !members.some((m) => m.calisanId === e.id))

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan Members</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : (
          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.name}</p>
                  {m.departman && <p className="text-muted-foreground truncate text-xs">{m.departman}</p>}
                </div>
                {canManage ? (
                  <Select value={m.role} onValueChange={(v) => void changeRole(m.id, v)}>
                    <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OWNER">OWNER</SelectItem>
                      <SelectItem value="MANAGER">MANAGER</SelectItem>
                      <SelectItem value="MEMBER">MEMBER</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium", ROLE_STYLES[m.role])}>{m.role}</span>
                )}
                {canManage && (
                  <button type="button" onClick={() => void removeMember(m.id)} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Üyeyi kaldır">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <div className="space-y-2 border-t pt-3">
            <Label className="text-xs">Add Member</Label>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <EmployeeCombobox options={availableEmployees} value={addCalisanId} onChange={setAddCalisanId} placeholder="Kişi seçin…" />
              </div>
              <Select value={addRole} onValueChange={setAddRole}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">MEMBER</SelectItem>
                  <SelectItem value="MANAGER">MANAGER</SelectItem>
                  <SelectItem value="OWNER">OWNER</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" size="icon" disabled={!addCalisanId || adding} onClick={() => void addMember()}>
                {adding ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
