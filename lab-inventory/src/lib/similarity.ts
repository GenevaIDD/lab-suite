/**
 * Duplicate item detection helpers.
 * Extracted here so they can be unit-tested independently of React components.
 */

/** Normalize: lowercase, strip accents, µ→u, non-alphanumeric→space, collapse */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining marks (é→e, ç→c)
    .replace(/[µμ]/g, 'u')           // µL → uL
    .replace(/[^a-z0-9]+/g, ' ')     // non-alphanumeric → space
    .trim()
}

/** Stop words excluded from token comparison */
const STOP = new Set(['de', 'du', 'le', 'la', 'les', 'un', 'une', 'et', 'ou', 'en', 'for', 'the', 'and'])

/** Significant tokens: words ≥ 3 chars, excluding stop words */
export function tokens(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(' ')
      .filter(t => t.length >= 3 && !STOP.has(t)),
  )
}

/** True if one token is a prefix of the other (min 4 chars) — catches plurals */
function tokensPrefixMatch(a: string, b: string): boolean {
  if (a.length < 4 || b.length < 4) return false
  return a.startsWith(b) || b.startsWith(a)
}

/**
 * Returns true if query and candidate are similar by any of:
 * 1. Case-insensitive substring match (after normalization)
 * 2. At least one shared significant token (exact)
 * 3. At least one token pair where one is a prefix of the other (handles plurals)
 */
export function isSimilar(query: string, candidate: string): boolean {
  if (query.length < 3) return false
  const nq = normalize(query)
  const nc = normalize(candidate)
  if (nc.includes(nq) || nq.includes(nc)) return true
  const tq = [...tokens(query)]
  const tc = [...tokens(candidate)]
  for (const a of tq) {
    for (const b of tc) {
      if (a === b || tokensPrefixMatch(a, b)) return true
    }
  }
  return false
}

/** Find up to maxResults existing items that are similar to the typed name */
export function findSimilar<T extends { name: string }>(
  name: string,
  items: T[],
  maxResults = 5,
): T[] {
  if (name.length < 3) return []
  return items.filter(it => isSimilar(name, it.name)).slice(0, maxResults)
}
