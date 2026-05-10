import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { Dashboard } from '@/pages/Dashboard'
import { Equipment } from '@/pages/Equipment'
import { EquipmentNew } from '@/pages/EquipmentNew'
import { EquipmentDetail } from '@/pages/EquipmentDetail'
import { Inventory } from '@/pages/Inventory'
import { InventoryNew } from '@/pages/InventoryNew'
import { DeliveryNew } from '@/pages/DeliveryNew'
import { Users } from '@/pages/Users'
import { ComingSoon } from '@/pages/ComingSoon'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="equipment" element={<Equipment />} />
            <Route path="equipment/new" element={<EquipmentNew />} />
            <Route path="equipment/:id" element={<EquipmentDetail />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="inventory/new" element={<InventoryNew />} />
            <Route path="inventory/delivery/new" element={<DeliveryNew />} />
            <Route
              path="inventory/stock-count"
              element={<ComingSoon title="Log Stock Count" backTo="/inventory" backLabel="Back to Inventory" />}
            />
            <Route path="users" element={<Users />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
