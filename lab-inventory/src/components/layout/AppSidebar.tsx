import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Wrench,
  Package,
  Users,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const navItems = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/equipment', label: 'Équipements', icon: Wrench },
  { to: '/inventory', label: 'Inventaire', icon: Package },
  { to: '/users', label: 'Utilisateurs', icon: Users },
]

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-4">
        <div className="flex flex-col items-center gap-1.5">
          <img
            src="/logo.svg"
            alt="Geneva Disease Dynamics"
            className="w-full max-w-[160px]"
          />
          <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
            Uvira Lab Management
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      isActive ? 'text-primary font-medium' : ''
                    }
                  >
                    {({ isActive }) => (
                      <SidebarMenuButton isActive={isActive}>
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t px-4 py-3">
        <p className="text-xs text-muted-foreground">Uvira, DRC · INRB Lab</p>
      </SidebarFooter>
    </Sidebar>
  )
}
