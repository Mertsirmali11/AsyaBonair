/**
 * Proxied URL for pending registration photos (approvers only).
 */
export function workerRegistrationPhotoPublicUrl(
  storagePath: string | null | undefined
): string | null {
  if (!storagePath?.trim()) return null
  const segments = storagePath.trim().split("/").filter(Boolean)
  if (segments.length === 0) return null
  return `/api/worker-registration-photo/${segments.map(encodeURIComponent).join("/")}`
}
