import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

export const PHOTO_BUCKET = 'equipment-photos'
export const DOC_BUCKET = 'equipment-documents'

// Both buckets are private (schema.sql), so objects can only be read through a
// signed URL. One hour is comfortably longer than a page visit; the query
// below refetches well before the signature lapses.
const SIGNED_URL_TTL_SECONDS = 3600
const SIGNED_URL_STALE_MS = 50 * 60 * 1000

/**
 * Normalise a stored reference to a bare object path.
 *
 * New uploads store the path alone. Rows written before the switch to signed
 * URLs hold a full `getPublicUrl()` result, which never worked against a
 * private bucket. Those are rewritten by fix_storage_signed_urls.sql, but this
 * tolerates either form so the UI works during and after the backfill.
 */
export function toObjectPath(stored: string, bucket: string): string {
  const trimmed = stored.trim()
  if (!trimmed) return ''

  for (const marker of [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/${bucket}/`,
  ]) {
    const i = trimmed.indexOf(marker)
    if (i !== -1) return stripQuery(trimmed.slice(i + marker.length))
  }

  return stripQuery(trimmed).replace(/^\/+/, '')
}

function stripQuery(s: string): string {
  const q = s.indexOf('?')
  return q === -1 ? s : s.slice(0, q)
}

/**
 * Resolve stored references to signed URLs.
 *
 * Returns a lookup taking the *stored* value (path or legacy URL) and giving
 * back a signed URL, or undefined while it is still being minted.
 */
export function useSignedUrls(bucket: string, stored: string[]) {
  const key = stored.join('|')
  const paths = useMemo(
    () => [...new Set(stored.map((s) => toObjectPath(s, bucket)).filter(Boolean))].sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bucket, key],
  )

  const { data } = useQuery({
    queryKey: ['signed-urls', bucket, paths],
    enabled: paths.length > 0,
    staleTime: SIGNED_URL_STALE_MS,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
      if (error) throw error
      const map: Record<string, string> = {}
      for (const row of data ?? []) {
        // Supabase echoes the requested path back on each row.
        if (row.path && row.signedUrl) map[row.path] = row.signedUrl
      }
      return map
    },
  })

  return (value: string): string | undefined => data?.[toObjectPath(value, bucket)]
}
