"use client"

import { IconInfoCircle } from "@tabler/icons-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useLanguage } from "@/lib/i18n/context"

export function DeptPermInfoTooltip() {
  const { t } = useLanguage()
  const dp = t.deptPermissions

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors mt-1"
            aria-label="Bilgi"
          >
            <IconInfoCircle className="size-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm text-left leading-relaxed" side="right">
          <p>
            <strong>{dp.cardDescBold1}</strong> {dp.cardDesc}
          </p>
          <p className="mt-1">
            <strong>{dp.cardDescBold2}</strong> {dp.cardDescBold2Suffix}
          </p>
          <p className="mt-1 text-muted-foreground">{dp.lockoutWarning}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
