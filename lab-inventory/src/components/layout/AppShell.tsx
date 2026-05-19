import { Outlet, useLocation } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { AppHeader } from './AppHeader'
import { Toaster } from '@/components/ui/sonner'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Tableau de bord',
  '/equipment': 'Équipements',
  '/equipment/new': 'Nouvel équipement',
  '/inventory': 'Inventaire',
  '/inventory/new': 'Nouvel article',
  '/inventory/delivery/new': 'Nouvelle livraison',
  '/inventory/stock-count': 'Comptage de stock',
  '/inventory/session/new': 'Démarrer l\'inventaire',
  '/users': 'Utilisateurs',
}

export function AppShell() {
  const { pathname } = useLocation()
  const title = PAGE_TITLES[pathname] ?? (pathname.startsWith('/equipment/') ? 'Équipements' : pathname.startsWith('/inventory/') ? 'Inventaire' : 'Inventaire Lab')

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader title={title} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  )
}
