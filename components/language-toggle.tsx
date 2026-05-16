"use client"

import { useLanguage } from "@/lib/i18n/context"
import { cn } from "@/lib/utils"

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLanguage()

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-lg border border-sidebar-border bg-sidebar p-0.5",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setLocale("tr")}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
          locale === "tr"
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
            : "text-sidebar-foreground/50 hover:text-sidebar-foreground"
        )}
      >
        TR
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
          locale === "en"
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
            : "text-sidebar-foreground/50 hover:text-sidebar-foreground"
        )}
      >
        EN
      </button>
    </div>
  )
}
