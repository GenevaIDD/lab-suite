import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext, useAuth, useAuthState } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { Equipment } from '@/pages/Equipment'
import { EquipmentNew } from '@/pages/EquipmentNew'
import { EquipmentDetail } from '@/pages/EquipmentDetail'
import { Inventory } from '@/pages/Inventory'
import { InventoryNew } from '@/pages/InventoryNew'
import { DeliveryNew } from '@/pages/DeliveryNew'
import { Users } from '@/pages/Users'
import { ComingSoon } from '@/pages/ComingSoon'
import { Loader2 } from 'lucide-react'

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

function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuthState()

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthGate>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
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
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
