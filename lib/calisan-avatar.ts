/**
 * Tarayıcıda gösterilecek profil görseli adresi.
 * Supabase public URL bucket kapalı / MIME kısıtlı olsa bile çalışması için uygulama içi proxy kullanılır.
 */
export function calisanAvatarPublicUrl(
  storagePath: string | null | undefined
): string | null {
  if (!storagePath?.trim()) return null
  const segments = storagePath.trim().split("/").filter(Boolean)
  if (segments.length === 0) return null
  return `/api/calisan-avatar/${segments.map(encodeURIComponent).join("/")}`
}
