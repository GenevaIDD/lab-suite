import type { TranslationKey } from './translations'

/**
 * Thrown by tryWriteOrQueue when a write is attempted with no connection and
 * offline queuing is disabled (see OFFLINE_WRITES_ENABLED in offline-queue).
 * A sentinel rather than a message, so the text stays translatable.
 */
export const OFFLINE_WRITE_REFUSED = 'OFFLINE_WRITE_REFUSED'

/** Turn a thrown write error into something a user should read. */
export function writeErrorMessage(
  err: unknown,
  t: (k: TranslationKey) => string,
): string {
  const msg = (err as Error)?.message ?? String(err)
  return msg === OFFLINE_WRITE_REFUSED ? t('error.offline.write') : msg
}
