import { useLang } from '@/lib/i18n'
import { isStaging } from '@/lib/env'
import { FlaskConical } from 'lucide-react'

// Fixed badge shown only on the staging deployment so it's never mistaken
// for production. Zero layout impact (fixed, corner-pinned).
export function EnvBanner() {
  const { t } = useLang()
  if (!isStaging) return null
  return (
    <div className="fixed bottom-3 right-3 z-[100] flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-amber-950 shadow-lg ring-1 ring-amber-600/40 pointer-events-none select-none">
      <FlaskConical className="h-3.5 w-3.5" />
      {t('env.staging')}
    </div>
  )
}
