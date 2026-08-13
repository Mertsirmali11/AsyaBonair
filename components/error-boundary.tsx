"use client"

import * as React from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Hata ekranında gösterilecek kısa başlık — bağlamı belirtir (örn. "Checklist"). */
  label?: string
  /** Kullanıcı "Yeniden Dene" bastığında, boundary sıfırlanmadan ÖNCE çağrılır — örn. veriyi
   * yeniden fetch etmek için. Boundary kendi state'ini sıfırlayıp children'ı yeniden mount eder. */
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Genel amaçlı React error boundary. Yalnızca class component olarak yazılabilir (React'ta
 * hook karşılığı yok). Sarmaladığı alt ağaçta render sırasında fırlatılan HERHANGİ BİR
 * beklenmeyen hatayı (örn. undefined bir alana erişim, bozuk API yanıtı işlenirken çöken bir
 * render) yakalar; tüm sayfayı/uygulamayı beyaz ekrana düşürmek yerine yalnızca bu alt ağacı
 * kısa bir hata mesajıyla değiştirir. Sidebar, üst başlık, diğer sayfa bölümleri etkilenmez —
 * kullanıcı sayfayı manuel yenilemek zorunda kalmadan "Yeniden Dene" ile devam edebilir.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ""}]`, error, info.componentStack)
  }

  handleRetry = () => {
    this.props.onReset?.()
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertTriangle className="size-6 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {this.props.label ? `${this.props.label} yüklenirken bir hata oluştu.` : "Bir hata oluştu."}
            </p>
            <p className="text-muted-foreground text-xs">
              Girdiğiniz veriler kaybolmadı. Sayfayı yenilemeden tekrar deneyebilirsiniz.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={this.handleRetry}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Yeniden Dene
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
