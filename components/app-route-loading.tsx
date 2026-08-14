"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

// Bu fallback normalde yalnızca birkaç yüz milisaniye görünür (segment RSC
// verisi gelene kadar). Ancak client-router bazen aynı rotaya üst üste
// binen (overlapping) bir RSC isteği gönderip öncekini iptal ediyor
// (net::ERR_ABORTED) — bu durumda Suspense sınırı promise'i hiç çözülmeyip
// bu fallback'te KALICI OLARAK asılı kalabiliyor; altındaki client component
// (ör. checklist/audit session state'i) hiç mount olamıyor ve kullanıcı
// manuel sayfa yenilemek zorunda kalıyor.
//
// Bu, gerçek sunucu/ağ gecikmesi arttıkça (yoğun trafik, büyük dosya
// yükleme vb.) daha olası hale geliyor. Aşağıdaki watchdog bu nadir
// durumdan otomatik kurtarma sağlar — normal (hızlı) sayfa yüklemelerini
// hiç etkilemez, yalnızca fallback beklenenden çok uzun sürerse devreye
// girer.
const AUTO_RETRY_MS = 6000
const SHOW_MANUAL_RETRY_MS = 12000

export function AppRouteLoading() {
  const router = useRouter()
  const [showManualRetry, setShowManualRetry] = React.useState(false)

  // GEÇİCİ TEŞHİS LOGU — bu fallback'in mount olduğu her an, gerçek bir route
  // segmenti Suspense'e düştüğü/yeniden RSC verisi beklediği andır. Root cause
  // netleşince kaldırılacak. Not: console.trace() next.config.ts'in
  // compiler.removeConsole'u tarafından prod'da SİLİNİR (yalnızca error/warn
  // korunuyor) — bu yüzden stack, `new Error().stack` ile alınıp console.warn
  // içine gömülüyor; böylece mount'u TAM OLARAK NEYİN tetiklediği (varsa) çağrı
  // yığınından görülebilir.
  React.useEffect(() => {
    console.warn(
      "[ROUTE-LOADING] mounted",
      {
        pathname: window.location.pathname,
        href: window.location.href,
        visibilityState: document.visibilityState,
        hasFocus: document.hasFocus(),
        ts: Date.now(),
        isoTime: new Date().toISOString(),
      },
      new Error("[ROUTE-LOADING] mount stack").stack
    )
    return () => {
      console.warn("[ROUTE-LOADING] unmounted", {
        pathname: window.location.pathname,
        href: window.location.href,
        visibilityState: document.visibilityState,
        ts: Date.now(),
        isoTime: new Date().toISOString(),
      })
    }
  }, [])

  React.useEffect(() => {
    const autoRetryTimer = window.setTimeout(() => {
      console.warn("[ROUTE-LOADING] retry/refresh triggered (auto, 6s)", { pathname: window.location.pathname, ts: Date.now() })
      router.refresh()
    }, AUTO_RETRY_MS)
    const manualRetryTimer = window.setTimeout(() => {
      setShowManualRetry(true)
    }, SHOW_MANUAL_RETRY_MS)
    return () => {
      window.clearTimeout(autoRetryTimer)
      window.clearTimeout(manualRetryTimer)
    }
  }, [router])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-6">
      {showManualRetry && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center dark:border-amber-800 dark:bg-amber-950/20">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Sayfa beklenenden uzun sürüyor.
          </p>
          <p className="text-muted-foreground max-w-sm text-xs">
            Bağlantı yavaş olabilir. Sayfayı yenileyebilirsiniz — daha önce
            kaydettiğiniz cevaplar ve dosyalar kaybolmaz.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-1.5 size-4" />
            Sayfayı yenile
          </Button>
        </div>
      )}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="min-h-[12rem] flex-1 rounded-xl" />
    </div>
  )
}
