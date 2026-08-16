/**
 * mevzuat.shgm.gov.tr kategori sayfaları — her biri `table#searchTable` içinde
 * (Başlık+PDF linki, Yayım Tarihi, Değişiklik Tarihi, Değişiklik No) satırları listeler.
 * Menü yapısı taranarak (2026-07) çıkarılmıştır; site menüsü değişirse burası güncellenmeli.
 */

import { slugifyManualTitle } from "@/lib/company-manual-slug"

export type ShgmCategoryKey =
  | "sektorel"
  | "kurumsal"
  | "uluslararasi"
  | "kaldirilan"

export const SHGM_CATEGORY_LABELS: Record<ShgmCategoryKey, string> = {
  sektorel: "Sektörel Mevzuat",
  kurumsal: "Kurumsal Mevzuat",
  uluslararasi: "Uluslararası Mevzuat",
  kaldirilan: "Kaldırılan Mevzuat",
}

export type ShgmSubPage = {
  category: ShgmCategoryKey
  /** Alt sayfa etiketi (Yönetmelikler, Talimatlar, ...) */
  label: string
  url: string
}

const BASE = "https://mevzuat.shgm.gov.tr/index.php"

export const SHGM_SUB_PAGES: ShgmSubPage[] = [
  // Sektörel Mevzuat
  { category: "sektorel", label: "Kanunlar", url: `${BASE}/kanunlar-2/` },
  { category: "sektorel", label: "Yönetmelikler", url: `${BASE}/yonetmelik/` },
  { category: "sektorel", label: "Talimatlar", url: `${BASE}/talimat/` },
  { category: "sektorel", label: "Genelgeler", url: `${BASE}/genelge/` },
  { category: "sektorel", label: "Direktifler", url: `${BASE}/direktifler/` },
  { category: "sektorel", label: "Taslaklar", url: `${BASE}/73-2/` },
  { category: "sektorel", label: "Tebliğ", url: `${BASE}/teblig/` },
  { category: "sektorel", label: "Emniyet Bülteni", url: `${BASE}/emniyet-bulteni-2/` },

  // Kurumsal Mevzuat
  { category: "kurumsal", label: "Cumhurbaşkanlığı Kararnamesi", url: `${BASE}/cumhurbaskanligi-kararnamesi/` },
  { category: "kurumsal", label: "Kanunlar", url: `${BASE}/kanunlarr/` },
  { category: "kurumsal", label: "Bakanlar Kurulu", url: `${BASE}/bakanlar-kurulu/` },
  { category: "kurumsal", label: "Yönetmelikler", url: `${BASE}/kurumsal-yonetmelikler/` },
  { category: "kurumsal", label: "Talimatlar", url: `${BASE}/kurumsal-talimatlar/` },
  { category: "kurumsal", label: "Genelgeler", url: `${BASE}/kurumsal-genelgeler/` },
  { category: "kurumsal", label: "Personel Tezleri", url: `${BASE}/personel-tezleri/` },

  // Uluslararası Mevzuat
  { category: "uluslararasi", label: "Kanunlar / Sözleşmeler", url: `${BASE}/kanunlar/` },
  { category: "uluslararasi", label: "Uygun Görme Kanunları", url: `${BASE}/uygun-gorme-kanunlari/` },
  { category: "uluslararasi", label: "Protokoller", url: `${BASE}/protokoller/` },
  { category: "uluslararasi", label: "Emniyet Bülteni", url: `${BASE}/emniyet-bulteni/` },
  { category: "uluslararasi", label: "İkili Hava Ulaştırma Anlaşmaları", url: `${BASE}/ikili-hava-ulastirma-anlasmalari/` },
  { category: "uluslararasi", label: "Diğer", url: `${BASE}/diger/` },

  // Kaldırılan Mevzuat
  { category: "kaldirilan", label: "Kanunlar", url: `${BASE}/yururlukten-kalkan-kanunlar/` },
  { category: "kaldirilan", label: "Yönetmelikler", url: `${BASE}/yururlukten-kalkan-yonetmelikler/` },
  { category: "kaldirilan", label: "Talimatlar", url: `${BASE}/yururlukten-kalkan-talimatlar/` },
  { category: "kaldirilan", label: "Genelgeler", url: `${BASE}/yururlukten-kalkan-genelgeler/` },
  { category: "kaldirilan", label: "Taslaklar", url: `${BASE}/yururlukten-kalkan-taslaklar/` },
]

/**
 * Portal ana ekranındaki "tür" kartları (Yönetmelikler, Talimatlar, ...) —
 * mevzuat.shgm.gov.tr menüsündeki alt sayfa etiketine karşılık gelir. DB'de ayrı
 * bir kolon olarak TUTULMAZ: `ShgmRegulation.sourceUrl` her zaman tarandığı
 * SHGM_SUB_PAGES girdisinin `url`'si olduğundan (bkz. lib/shgm/sync.ts,
 * lib/shgm/scrape.ts), tür buradan geri türetilir — migration gerekmez.
 *
 * "Kaldırılan Mevzuat" kategorisi tür ayrımından bağımsız TEK kart olarak kalır
 * (kullanıcı isteği — kaldırılan bir Yönetmelik, aktif Yönetmelikler kartına değil
 * Kaldırılan Mevzuat kartına düşer).
 *
 * Aynı etiket birden çok üst kategoride geçiyorsa (ör. "Talimatlar" hem sektörel
 * hem kurumsal altında var) kartlar bilerek birleştirilir — SHGM portalında da
 * kullanıcı türe göre gezinir, üst kategoriye göre değil.
 */
const TYPE_DISPLAY_LABEL_OVERRIDES: Record<string, string> = {
  "Tebliğ": "Tebliğler",
  "Emniyet Bülteni": "Emniyet Bültenleri",
}

export type ShgmRegulationType = {
  /** Etiketten türetilen kararlı anahtar (slug) — "kaldirilan" özel değeri hariç. */
  key: string
  /** Ekranda gösterilecek ad (ör. "Talimatlar", "Kaldırılan Mevzuat"). */
  label: string
}

const KALDIRILAN_TYPE: ShgmRegulationType = {
  key: "kaldirilan",
  label: SHGM_CATEGORY_LABELS.kaldirilan,
}

/**
 * Bir mevzuat kaydının (category, sourceUrl) çiftinden portal türünü türetir.
 * `sourceUrl` SHGM_SUB_PAGES'teki taranan sayfanın URL'siyle birebir eşleşmelidir
 * (her zaman öyledir); eşleşme bulunamazsa (site menüsü değiştiyse) üst
 * kategori etiketine düşer — kayıt kaybolmaz, sadece daha kaba bir kartta görünür.
 */
export function getShgmRegulationType(category: string, sourceUrl: string): ShgmRegulationType {
  if (category === "kaldirilan") return KALDIRILAN_TYPE

  const subPage = SHGM_SUB_PAGES.find((p) => p.category === category && p.url === sourceUrl)
  const rawLabel = subPage?.label ?? SHGM_CATEGORY_LABELS[category as ShgmCategoryKey] ?? category
  const label = TYPE_DISPLAY_LABEL_OVERRIDES[rawLabel] ?? rawLabel
  return { key: slugifyManualTitle(rawLabel), label }
}
