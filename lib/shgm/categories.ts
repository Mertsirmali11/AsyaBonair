/**
 * mevzuat.shgm.gov.tr kategori sayfaları — her biri `table#searchTable` içinde
 * (Başlık+PDF linki, Yayım Tarihi, Değişiklik Tarihi, Değişiklik No) satırları listeler.
 * Menü yapısı taranarak (2026-07) çıkarılmıştır; site menüsü değişirse burası güncellenmeli.
 */

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
