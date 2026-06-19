import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Users as UsersIcon, Check, Minus, Loader2, Info, UserPlus, Power, Pencil, X } from 'lucide-react'
import { useAuth, canManageUsers, ROLES } from '@/lib/auth'
import { useProfiles } from '@/lib/queries'
import { useUpdateProfileRole, useUpdateProfileName, useInviteUser, useSetUserActive } from '@/lib/mutations'
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
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
            {t('users.list.title')}
          </CardTitle>
          {isAdmin && <InviteDialog />}
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
                  <TableHead className="w-52">{t('users.col.role')}</TableHead>
                  <TableHead className="w-28">{t('users.col.status')}</TableHead>
                  {isAdmin && <TableHead className="w-32 text-right">{t('users.col.actions')}</TableHead>}
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

function InviteDialog() {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('tech')
  const invite = useInviteUser()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    try {
      await invite.mutateAsync({ email: email.trim(), full_name: name.trim(), role })
      toast.success(t('users.invite.success'))
      setOpen(false)
      setEmail(''); setName(''); setRole('tech')
    } catch (err) {
      toast.error(`${t('users.invite.error')} : ${(err as Error).message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><UserPlus className="h-4 w-4 mr-1" />{t('users.invite.btn')}</Button>} />
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t('users.invite.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <p className="text-sm text-muted-foreground">{t('users.invite.desc')}</p>
            <div className="space-y-1">
              <Label htmlFor="inv-email">{t('users.invite.email')}</Label>
              <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-name">{t('users.invite.name')}</Label>
              <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-role">{t('users.invite.role')}</Label>
              <Select value={role} onValueChange={(v) => setRole((v ?? 'tech') as UserRole)}>
                <SelectTrigger id="inv-role" className="w-full">
                  <SelectValue>{(v) => roleLabel(t, String(v))}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel(t, r)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('users.cancel')}</Button>
            <Button type="submit" disabled={!email.trim() || invite.isPending}>
              {invite.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('users.invite.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function UserRow({ user, isAdmin, isSelf }: { user: Profile; isAdmin: boolean; isSelf: boolean }) {
  const { t } = useLang()
  const updateRole = useUpdateProfileRole()
  const updateName = useUpdateProfileName()
  const setActive = useSetUserActive()
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(user.full_name)
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

  async function saveName() {
    const next = nameDraft.trim()
    if (!next || next === user.full_name) { setEditingName(false); return }
    try {
      await updateName.mutateAsync({ id: user.id, full_name: next })
      toast.success(t('users.name.updated'))
      setEditingName(false)
    } catch (err) {
      toast.error(`${t('users.name.error')} : ${(err as Error).message}`)
    }
  }

  async function toggleActive() {
    const next = !user.is_active
    if (!next && !window.confirm(t('users.deactivate.confirm'))) return
    try {
      await setActive.mutateAsync({ id: user.id, is_active: next })
      toast.success(next ? t('users.reactivated.toast') : t('users.deactivated.toast'))
    } catch (err) {
      toast.error(`${t('users.active.error')} : ${(err as Error).message}`)
    }
  }

  return (
    <TableRow className={user.is_active ? undefined : 'opacity-60'}>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {editingName ? (
              <div className="flex items-center gap-1">
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="h-7 text-sm w-44"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                />
                <button type="button" onClick={saveName} disabled={updateName.isPending} className="p-1 rounded hover:bg-muted text-emerald-600" title={t('users.save')}>
                  {updateName.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => { setEditingName(false); setNameDraft(user.full_name) }} className="p-1 rounded hover:bg-muted text-muted-foreground" title={t('users.cancel')}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-sm font-medium truncate flex items-center gap-1.5 group">
                {user.full_name || '—'}
                {isSelf && <Badge variant="outline" className="text-[10px] px-1 py-0">{t('users.you')}</Badge>}
                {isAdmin && (
                  <button type="button" onClick={() => { setNameDraft(user.full_name); setEditingName(true) }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted text-muted-foreground transition-opacity" title={t('users.edit.name')}>
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </p>
            )}
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
      <TableCell>
        <Badge variant={user.is_active ? 'outline' : 'secondary'} className="text-xs">
          {user.is_active ? t('users.status.active') : t('users.status.inactive')}
        </Badge>
      </TableCell>
      {isAdmin && (
        <TableCell className="text-right">
          {!isSelf && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleActive}
              disabled={setActive.isPending}
              className={user.is_active ? 'text-destructive hover:text-destructive' : ''}
            >
              {setActive.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Power className="h-3.5 w-3.5 mr-1" />}
              {user.is_active ? t('users.deactivate') : t('users.reactivate')}
            </Button>
          )}
        </TableCell>
      )}
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
