import { Component, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { AppHeader } from './AppHeader'
import { Toaster } from '@/components/ui/sonner'
import { AlertTriangle, RefreshCw } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Tableau de bord',
  '/equipment': 'Équipements',
  '/equipment/new': 'Nouvel équipement',
  '/inventory': 'Inventaire',
  '/inventory/new': 'Nouvel article',
  '/inventory/delivery/new': 'Nouvelle livraison',
  '/inventory/stock-count': 'Comptage rapide',
  '/inventory/session/new': 'Inventaire complet',
  '/users': 'Utilisateurs',
}

// ── Error boundary ────────────────────────────────────────────
class PageErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 py-20 text-center px-6">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <div className="space-y-1">
            <p className="font-semibold">Une erreur est survenue sur cette page.</p>
            <p className="text-sm text-muted-foreground">
              {(this.state.error as Error).message}
            </p>
          </div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.href = '/' }}
            className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Recharger la page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Shell ─────────────────────────────────────────────────────
export function AppShell() {
  const { pathname } = useLocation()
  const title = PAGE_TITLES[pathname] ?? (
    pathname.startsWith('/equipment/') ? 'Équipements'
    : pathname.startsWith('/inventory/') ? 'Inventaire'
    : 'Inventaire Lab'
  )

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader title={title} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <PageErrorBoundary>
            <Outlet />
          </PageErrorBoundary>
        </main>
      </SidebarInset>
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  )
}
