import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Wrench,
  Package,
  Users,
} from 'lucide-react'
import { useLang } from '@/lib/i18n'
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

export function AppSidebar() {
  const { t } = useLang()
  const navItems = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/equipment', label: t('nav.equipment'), icon: Wrench },
    { to: '/inventory', label: t('nav.inventory'), icon: Package },
    { to: '/users', label: t('nav.users'), icon: Users },
  ]
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
        <p className="text-xs text-muted-foreground">{t('nav.location')}</p>
      </SidebarFooter>
    </Sidebar>
  )
}
