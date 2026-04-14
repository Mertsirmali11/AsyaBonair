"use client"

import * as React from "react"
import Link from "next/link"
import { IconHelpCircle } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * Üst başlıktaki «Manuals» yanında; üzerine gelince revizyon / yükleme açıklamaları.
 */
export function ManualsHeaderHelp() {
  const [open, setOpen] = React.useState(false)
  const closeTimer = React.useRef<number | null>(null)

  const cancelClose = React.useCallback(() => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const scheduleClose = React.useCallback(() => {
    cancelClose()
    closeTimer.current = window.setTimeout(() => setOpen(false), 220)
  }, [cancelClose])

  const openNow = React.useCallback(() => {
    cancelClose()
    setOpen(true)
  }, [cancelClose])

  React.useEffect(() => () => cancelClose(), [cancelClose])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground size-7 shrink-0 rounded-full"
          aria-label="Manuel ve revizyon hakkında bilgi"
          onMouseEnter={openNow}
          onMouseLeave={scheduleClose}
          onFocus={openNow}
          onBlur={scheduleClose}
        >
          <IconHelpCircle className="size-5" stroke={1.5} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="max-h-[min(72vh,28rem)] w-[min(calc(100vw-2rem),22rem)] overflow-y-auto p-4 text-left text-sm leading-relaxed shadow-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onMouseEnter={openNow}
        onMouseLeave={scheduleClose}
      >
        <p className="mb-3 font-medium text-foreground">Revizyon takibi</p>
        <ul className="text-muted-foreground list-inside list-disc space-y-2">
          <li>
            <strong className="text-foreground">Güncel sürüm:</strong> Listede her kitap
            için yalnızca girdiğiniz revizyon numarasıyla kayıtlı güncel dosya görünür
            (Bonair AI da bunu kullanır).
          </li>
          <li>
            <strong className="text-foreground">Yükleme:</strong>{" "}
            <strong className="text-foreground">Admin</strong>,{" "}
            <strong className="text-foreground">Quality</strong> veya{" "}
            <strong className="text-foreground">Human Resources</strong> departmanı{" "}
            <strong className="text-foreground">Doküman yükleme</strong> kutusundan yeni
            manuel veya mevcut seriye revizyon ekler. Yeni revizyon kaydında önceki güncel
            satır otomatik arşive alınır.
          </li>
          <li>
            <strong className="text-foreground">PDF ile revizyon:</strong>{" "}
            <strong className="text-foreground">Düzenle</strong> → PDF önizle; düzenlemeyi
            bilgisayarınızda bitirip{" "}
            <strong className="text-foreground">Yeni revizyon numarası ver</strong> ile PDF
            ve numarayı kaydedin — önceki güncel sürüm yine arşive gider.
          </li>
          <li>
            <strong className="text-foreground">Listeden arşiv:</strong> Klasör simgesi
            (Move to previous) güncel satırı arşivler.
          </li>
          <li>
            <strong className="text-foreground">Eski revizyonlar:</strong> Sayfa altındaki
            arşiv listesini yalnızca departmanı{" "}
            <strong className="text-foreground">Admin</strong> olan kullanıcılar görür.
            Atama:{" "}
            <Link
              href="/configurations"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Configurations → User settings
            </Link>
            .
          </li>
          <li>
            <strong className="text-foreground">Kim yükledi / departman:</strong> Satırda
            yükleyen bilgisi; sahip departman standart liste veya özel etiket (en fazla
            100 karakter).
          </li>
        </ul>
        <p className="text-muted-foreground mt-3 border-t pt-3 text-xs">
          Doküman yükleyemiyorsanız User settings’te departmanınızı kontrol edin; değişiklik
          sonrası bir kez çıkış yapıp giriş yapın.
        </p>
      </PopoverContent>
    </Popover>
  )
}
