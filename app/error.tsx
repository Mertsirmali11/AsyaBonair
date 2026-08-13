"use client"

import * as React from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

/**
 * Bu proje daha önce hiç bir error.tsx içermiyordu — yani root layout dışındaki
 * herhangi bir Server Component (ör. (workspace)/layout.tsx içindeki bir DB
 * sorgusu geçici olarak başarısız olduğunda) beklenmedik bir hata fırlattığında,
 * Next.js'in tamamen jenerik, boş "Application error: a server-side exception
 * has occurred... Digest: XXXXXXX" sayfası devreye giriyordu — sidebar dahil
 * her şey kayboluyordu ve kullanıcının elinde sayfayı yenilemekten başka
 * hiçbir seçenek kalmıyordu.
 *
 * Bu dosya (app/ kökünde) (workspace)/layout.tsx dahil, root layout'un ALTINDA
 * kalan her segment'teki hataları yakalar. Root layout (sidebar/header'ı içeren
 * kabuk) bu segment'in DIŞINDA olduğu için, buradaki bir hata artık sidebar'ı
 * götürmüyor; yalnızca içerik alanı bu ekranla değişiyor ve "Tekrar Dene"
 * (reset()) ile o segment sayfayı tam yenilemeden yeniden render edilmeyi dener.
 */
export default function RootSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error("[app/error.tsx] Uncaught server-side exception:", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="size-10 text-destructive" />
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold">Bir şeyler ters gitti.</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          Beklenmeyen bir sunucu hatası oluştu. Daha önce girdiğiniz veriler kaybolmamış olabilir —
          önce &quot;Tekrar Dene&quot;yi deneyin; sorun devam ederse sayfayı yenileyin.
        </p>
        {error.digest && (
          <p className="text-muted-foreground/70 font-mono text-xs">Digest: {error.digest}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => reset()}
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors"
      >
        <RefreshCw className="size-3.5" />
        Tekrar Dene
      </button>
    </div>
  )
}
