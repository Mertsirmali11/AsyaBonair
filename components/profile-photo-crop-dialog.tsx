"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const OUTPUT_SIZE = 512
const MIN_ZOOM = 1
const MAX_ZOOM = 3

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

type ProfilePhotoCropDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: File | null
  onConfirm: (croppedFile: File) => void
  uploading?: boolean
}

export function ProfilePhotoCropDialog({
  open,
  onOpenChange,
  file,
  onConfirm,
  uploading = false,
}: ProfilePhotoCropDialogProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null)
  const [natural, setNatural] = React.useState({ w: 0, h: 0 })
  const [containerW, setContainerW] = React.useState(280)
  const [zoom, setZoom] = React.useState(1)
  const [pan, setPan] = React.useState({ x: 0, y: 0 })
  const dragRef = React.useRef<{
    active: boolean
    startX: number
    startY: number
    panX: number
    panY: number
    pointerId: number
  } | null>(null)
  const [dragging, setDragging] = React.useState(false)

  React.useEffect(() => {
    if (!open || !file) {
      setNatural({ w: 0, h: 0 })
      setZoom(1)
      setPan({ x: 0, y: 0 })
      return
    }
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    const img = new Image()
    img.onload = () => {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight })
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
    img.src = url
    return () => {
      URL.revokeObjectURL(url)
      setObjectUrl(null)
    }
  }, [open, file])

  const measureContainer = React.useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const w = el.offsetWidth
    if (w > 0) setContainerW(w)
  }, [])

  React.useLayoutEffect(() => {
    if (!open) return
    measureContainer()
    const ro = new ResizeObserver(() => measureContainer())
    const el = containerRef.current
    if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [open, measureContainer, natural.w])

  const { displayW, displayH, panBounds } = React.useMemo(() => {
    const W = containerW
    const iw = natural.w
    const ih = natural.h
    if (!W || !iw || !ih) {
      return { displayW: 0, displayH: 0, panBounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } }
    }
    const base = Math.max(W / iw, W / ih)
    const s = base * zoom
    const dw = iw * s
    const dh = ih * s
    const minX = W / 2 - dw / 2
    const maxX = dw / 2 - W / 2
    const minY = W / 2 - dh / 2
    const maxY = dh / 2 - W / 2
    return {
      displayW: dw,
      displayH: dh,
      panBounds: { minX, maxX, minY, maxY },
    }
  }, [containerW, natural.w, natural.h, zoom])

  React.useEffect(() => {
    setPan((p) => ({
      x: clamp(p.x, panBounds.minX, panBounds.maxX),
      y: clamp(p.y, panBounds.minY, panBounds.maxY),
    }))
  }, [panBounds.minX, panBounds.maxX, panBounds.minY, panBounds.maxY])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    setDragging(true)
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
      pointerId: e.pointerId,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d?.active || e.pointerId !== d.pointerId) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    setPan({
      x: clamp(d.panX + dx, panBounds.minX, panBounds.maxX),
      y: clamp(d.panY + dy, panBounds.minY, panBounds.maxY),
    })
  }

  const endDrag = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || e.pointerId !== d.pointerId) return
    dragRef.current = null
    setDragging(false)
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const handleConfirm = async () => {
    if (!file || !objectUrl || !natural.w || !natural.h || !containerW) return
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = objectUrl
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error("load failed"))
    })

    const W = containerW
    const iw = natural.w
    const ih = natural.h
    const base = Math.max(W / iw, W / ih)
    const s = base * zoom
    const dw = iw * s
    const dh = ih * s
    const imgLeft = W / 2 + pan.x - dw / 2
    const imgTop = W / 2 + pan.y - dh / 2

    let sx = ((0 - imgLeft) / dw) * iw
    let sy = ((0 - imgTop) / dh) * ih
    let sw = (W / dw) * iw
    let sh = (W / dh) * ih

    sx = clamp(sx, 0, iw)
    sy = clamp(sy, 0, ih)
    sw = clamp(sw, 0, iw - sx)
    sh = clamp(sh, 0, ih - sy)

    const canvas = document.createElement("canvas")
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.92)
    )
    if (!blob) return
    const cropped = new File([blob], "profile-photo.jpg", { type: "image/jpeg" })
    onConfirm(cropped)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="space-y-1 border-b border-border px-6 py-4 text-left">
          <DialogTitle>Profile picture</DialogTitle>
          <DialogDescription>
            Center the image in the frame by dragging; zoom in if needed. A square image (512 px)
            will be uploaded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div
            ref={containerRef}
            className={cn(
              "relative mx-auto aspect-square w-full max-w-[320px] touch-none select-none overflow-hidden rounded-full border-2 border-border bg-muted shadow-inner",
              "ring-2 ring-ring/20"
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{ cursor: dragging ? "grabbing" : "grab" }}
          >
            {objectUrl && natural.w > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                src={objectUrl}
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={{
                  width: displayW,
                  height: displayH,
                  transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
                }}
              />
            ) : (
              <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="avatar-zoom" className="text-muted-foreground">
                Zoom
              </Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {zoom.toFixed(2)}×
              </span>
            </div>
            <input
              id="avatar-zoom"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              disabled={uploading || !natural.w}
              className="h-2 w-full cursor-pointer accent-primary disabled:opacity-50"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Tip: Click and drag the photo to reposition it. The circle matches the profile frame
            shown elsewhere in the app.
          </p>
        </div>

        <DialogFooter className="gap-2 border-t border-border bg-muted/40 px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={uploading || !natural.w}
            onClick={() => void handleConfirm()}
          >
            {uploading ? "Uploading…" : "Save and upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
