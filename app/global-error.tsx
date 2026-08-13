"use client"

import * as React from "react"

/**
 * Son çare boundary — yalnızca ROOT layout'un (app/layout.tsx) kendisi hata
 * fırlatırsa devreye girer (çok nadir). Root layout artık render edilemediği
 * için bu dosya kendi <html>/<body>'sini içermek ZORUNDADIR (Next.js kuralı).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error("[app/global-error.tsx] Root layout exception:", error)
  }, [error])

  return (
    <html lang="tr">
      <body style={{ fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Bir şeyler ters gitti.</h1>
          <p style={{ color: "#6b7280", fontSize: "0.875rem", maxWidth: "28rem" }}>
            Beklenmeyen bir uygulama hatası oluştu. Lütfen tekrar deneyin.
          </p>
          {error.digest && (
            <p style={{ color: "#9ca3af", fontFamily: "monospace", fontSize: "0.75rem" }}>
              Digest: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#111827",
              color: "#fff",
              border: "none",
              borderRadius: "0.375rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Tekrar Dene
          </button>
        </div>
      </body>
    </html>
  )
}
