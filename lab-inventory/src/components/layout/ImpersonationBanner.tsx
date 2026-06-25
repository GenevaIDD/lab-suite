import { useAuth } from '@/lib/auth'
import { useLang } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/translations'
import { Eye, X } from 'lucide-react'

// Prominent banner shown while an admin is previewing the app as another role.
// Makes the impersonation obvious and offers a one-click exit. The override is
// UI-only — writes still run with the admin's real permissions.
export function ImpersonationBanner() {
  const { t } = useLang()
  const { viewAsRole, setViewAsRole } = useAuth()
  if (!viewAsRole) return null
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 rounded-full bg-violet-600 px-3 py-1 text-xs font-medium text-white shadow-lg ring-1 ring-violet-700/40">
      <Eye className="h-3.5 w-3.5" />
      <span>{t('viewas.banner')} {t(`users.role.${viewAsRole}` as TranslationKey)}</span>
      <button
        onClick={() => setViewAsRole(null)}
        className="flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 hover:bg-white/30 transition-colors"
      >
        <X className="h-3 w-3" />
        {t('viewas.exit')}
      </button>
    </div>
  )
}
