import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Users as UsersIcon, Check, Minus, Loader2, Info } from 'lucide-react'
import { useAuth, canManageUsers, ROLES } from '@/lib/auth'
import { useProfiles } from '@/lib/queries'
import { useUpdateProfileRole } from '@/lib/mutations'
import { useLang } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/translations'
import type { Profile, UserRole } from '@/types/database'
import { toast } from 'sonner'

// Which roles hold each capability — mirrors the permission helpers in
// src/lib/auth.ts and the RLS policies in supabase/schema.sql.
const CAPABILITIES: { key: TranslationKey; roles: UserRole[] }[] = [
  { key: 'cap.view',         roles: ['admin', 'lab_manager', 'tech', 'lab_team'] },
  { key: 'cap.session',      roles: ['admin', 'lab_manager', 'tech', 'lab_team'] },
  { key: 'cap.delivery',     roles: ['admin', 'lab_manager', 'tech', 'lab_team'] },
  { key: 'cap.maint.log',    roles: ['admin', 'lab_manager', 'tech', 'lab_team'] },
  { key: 'cap.stockcount',   roles: ['admin', 'lab_manager', 'tech'] },
  { key: 'cap.create.item',  roles: ['admin', 'lab_manager', 'lab_team'] },
  { key: 'cap.create.equip', roles: ['admin', 'lab_manager', 'lab_team'] },
  { key: 'cap.maint.sched',  roles: ['admin', 'lab_manager', 'lab_team'] },
  { key: 'cap.edit',         roles: ['admin', 'lab_manager'] },
  { key: 'cap.delete',       roles: ['admin'] },
  { key: 'cap.users',        roles: ['admin'] },
]

function roleLabel(t: (k: TranslationKey) => string, role: string): string {
  return t(`users.role.${role}` as TranslationKey)
}

export function Users() {
  const { t } = useLang()
  const { profile } = useAuth()
  const isAdmin = canManageUsers(profile)
  const { data: users = [], isLoading, error } = useProfiles()

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>{t('users.create.note')}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
            {t('users.list.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('users.loading')}
            </div>
          ) : error ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t('users.error')}</p>
          ) : users.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t('users.empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('users.col.user')}</TableHead>
                  <TableHead className="w-56">{t('users.col.role')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <UserRow key={u.id} user={u} isAdmin={isAdmin} isSelf={u.id === profile?.id} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PermissionsCard />
    </div>
  )
}

function UserRow({ user, isAdmin, isSelf }: { user: Profile; isAdmin: boolean; isSelf: boolean }) {
  const { t } = useLang()
  const updateRole = useUpdateProfileRole()
  const initials = (user.full_name || user.email).split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  async function onRoleChange(role: string | null) {
    if (!role || role === user.role) return
    try {
      await updateRole.mutateAsync({ id: user.id, role: role as UserRole })
      toast.success(t('users.role.updated'))
    } catch (err) {
      toast.error(`${t('users.role.error')} : ${(err as Error).message}`)
    }
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate flex items-center gap-1.5">
              {user.full_name || '—'}
              {isSelf && <Badge variant="outline" className="text-[10px] px-1 py-0">{t('users.you')}</Badge>}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {isAdmin && !isSelf ? (
          <Select value={user.role} onValueChange={onRoleChange} disabled={updateRole.isPending}>
            <SelectTrigger className="w-full">
              {updateRole.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <SelectValue>{(v) => roleLabel(t, String(v))}</SelectValue>}
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>{roleLabel(t, r)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge
            variant="secondary"
            className="text-xs"
            title={isSelf && isAdmin ? t('users.self.locked') : undefined}
          >
            {roleLabel(t, user.role)}
          </Badge>
        )}
      </TableCell>
    </TableRow>
  )
}

function PermissionsCard() {
  const { t } = useLang()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('users.perms.title')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-52">{t('users.perms.cap')}</TableHead>
              {ROLES.map((r) => (
                <TableHead key={r} className="text-center whitespace-nowrap">{roleLabel(t, r)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {CAPABILITIES.map((cap) => (
              <TableRow key={cap.key}>
                <TableCell className="text-sm">{t(cap.key)}</TableCell>
                {ROLES.map((r) => (
                  <TableCell key={r} className="text-center">
                    {cap.roles.includes(r)
                      ? <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                      : <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" />}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
