import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Users as UsersIcon } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  supervisor: 'Supervisor',
  tech: 'Lab Tech',
}

export function Users() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Users are managed through Supabase Auth. Role assignment happens in the profiles table.
      </p>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
            <UsersIcon className="h-8 w-8 opacity-30" />
            <p className="text-sm">User list will appear here once auth is configured.</p>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground flex gap-2 items-center">
        Roles:
        {Object.entries(ROLE_LABELS).map(([key, label]) => (
          <Badge key={key} variant="outline" className="text-xs">{label}</Badge>
        ))}
      </div>
    </div>
  )
}

export function UserRow({ name, email, role }: { name: string; email: string; role: string }) {
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase()
  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{email}</p>
      </div>
      <Badge variant="secondary" className="text-xs shrink-0">{ROLE_LABELS[role] ?? role}</Badge>
    </div>
  )
}
