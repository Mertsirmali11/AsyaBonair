"use client"

import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { useLanguage } from "@/lib/i18n/context"
import type { TranslationKey } from "@/lib/i18n/translations"

type NavKey = keyof TranslationKey["nav"]

/**
 * SetWorkspacePageTitle'ın i18n-aware versiyonu.
 * - navKey: tek bir t.nav.* anahtarı
 * - navKeys: birden fazla anahtar → " · " ile birleştirilir (örn. "Kontrollü Dokümanlar · Manueller")
 * - suffix: sabit son ek (örn. " — TC-ASY")
 */
export function NavPageTitle({
  navKey,
  navKeys,
  suffix,
}: {
  navKey?: NavKey
  navKeys?: NavKey[]
  suffix?: string
}) {
  const { t } = useLanguage()

  let base: string
  if (navKeys && navKeys.length > 0) {
    base = navKeys.map((k) => t.nav[k] as string).join(" · ")
  } else if (navKey) {
    base = t.nav[navKey] as string
  } else {
    base = ""
  }

  const title = suffix ? `${base}${suffix}` : base
  return <SetWorkspacePageTitle title={title} />
}
