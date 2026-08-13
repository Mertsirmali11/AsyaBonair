"use client"

import * as React from "react"
import { CalendarRange, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DatePicker } from "@/components/ui/date-picker"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { parseDdMmYyyyToUtcDate } from "@/lib/correspondence-date"

/**
 * "Bir audit Postponed durumuna alınırken" gösterilen modal — Manage Audit ve Audit Plan
 * tablosundaki hızlı durum aksiyonlarının İKİSİ tarafından da kullanılır (aynı akış, tek
 * component; paralel bir modal/mantık oluşturulmadı). Postponed Date zorunludur.
 */
export function PostponeAuditDialog({
  open,
  onOpenChange,
  plannedDate,
  initialPostponedDate,
  loading = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Mevcut planlanan tarih (dd.MM.yyyy) — salt okunur referans olarak gösterilir. */
  plannedDate: string
  /** Zaten Postponed ise mevcut Postponed Date ile önceden doldurulur. */
  initialPostponedDate?: string | null
  loading?: boolean
  onConfirm: (postponedDate: string, reason: string) => void | Promise<void>
}) {
  const [postponedDate, setPostponedDate] = React.useState("")
  const [reason, setReason] = React.useState("")

  React.useEffect(() => {
    if (open) {
      setPostponedDate(initialPostponedDate ?? "")
      setReason("")
    }
  }, [open, initialPostponedDate])

  const isValid = !!parseDdMmYyyyToUtcDate(postponedDate)

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="size-4 text-sky-600" />
            Postpone Audit / Denetimi Ertele
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium">Current Planned Date</p>
            <p className="text-sm font-mono">{plannedDate || "—"}</p>
          </div>
          <div className="space-y-1.5">
            <Label>New Postponed Date / Ertelenen Tarih *</Label>
            <DatePicker value={postponedDate} onChange={setPostponedDate} placeholder="dd.mm.yyyy" disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <Label>Postponement Reason (Optional) / Erteleme Nedeni</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="İsteğe bağlı açıklama…"
              className="min-h-[70px]"
              disabled={loading}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={loading || !isValid}
            onClick={() => void onConfirm(postponedDate, reason.trim())}
          >
            {loading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <CalendarRange className="mr-1.5 size-4" />}
            Confirm Postponement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
