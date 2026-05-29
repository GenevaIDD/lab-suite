import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Wifi, WifiOff, CloudUpload, LogOut } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useAuth, signOut, ROLE_LABELS } from '@/lib/auth'
import { useLang } from '@/lib/i18n'
import { toast } from 'sonner'

interface AppHeaderProps {
  title: string
}

export function AppHeader({ title }: AppHeaderProps) {
  const { isOnline, pendingWrites } = useOnlineStatus()
  const { profile } = useAuth()
  const { lang, setLang, t } = useLang()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?'

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  async function handleSignOut() {
    setOpen(false)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      toast.error(t('header.signout.failed'))
    }
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <h1 className="text-base font-semibold">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          className="text-xs font-medium text-muted-foreground hover:text-foreground border rounded px-1.5 py-0.5 transition-colors"
          title={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
        >
          {lang === 'fr' ? 'EN' : 'FR'}
        </button>

        {pendingWrites > 0 && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <CloudUpload className="h-3 w-3" />
            {pendingWrites} {t('header.pending')}
          </Badge>
        )}
        {isOnline ? (
          <Badge variant="outline" className="gap-1 text-xs text-green-600 border-green-200">
            <Wifi className="h-3 w-3" />
            {t('header.online')}
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-xs text-amber-600 border-amber-200">
            <WifiOff className="h-3 w-3" />
            {t('header.offline')}
          </Badge>
        )}

        {/* Account menu — plain CSS dropdown, no Base UI */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Account menu"
            aria-expanded={open}
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-lg border bg-popover shadow-md z-50">
              {/* User info */}
              <div className="px-3 py-2.5 border-b">
                <p className="text-sm font-medium truncate">{profile?.full_name ?? 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{profile?.email ?? ''}</p>
                {profile?.role && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {ROLE_LABELS[profile.role] ?? profile.role}
                  </Badge>
                )}
              </div>
              {/* Sign out */}
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {t('header.signout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
