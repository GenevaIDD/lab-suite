import type { StorageCondition } from '@/types/database'
import type { TranslationKey } from './translations'

// Storage conditions for inventory items. Stable codes; labels are localized.
export const STORAGE_CONDITIONS: StorageCondition[] = ['ambient', 'refrigerator', 'freezer']

export function storageLabel(t: (k: TranslationKey) => string, value: string | null | undefined): string {
  if (!value) return ''
  return t(`item.storage.${value}` as TranslationKey)
}
