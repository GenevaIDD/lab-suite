import { Outlet, useLocation } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { AppHeader } from './AppHeader'
import { Toaster } from '@/components/ui/sonner'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/equipment': 'Equipment',
  '/equipment/new': 'New Equipment',
  '/inventory': 'Inventory',
  '/inventory/new': 'New Item',
  '/inventory/delivery/new': 'New Delivery',
  '/inventory/stock-count': 'Stock Count',
  '/users': 'Users',
}

export function AppShell() {
  const { pathname } = useLocation()
  const title = PAGE_TITLES[pathname] ?? (pathname.startsWith('/equipment/') ? 'Equipment' : 'Lab Inventory')

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
