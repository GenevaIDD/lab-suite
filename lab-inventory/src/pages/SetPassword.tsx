import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useLang } from '@/lib/i18n'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'

// Landing page for invite links. Supabase establishes a session from the
// token in the URL; the invited user picks a password to activate the account.
export function SetPassword() {
  const navigate = useNavigate()
  const { t } = useLang()
  const { session, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { toast.error(t('setpw.short')); return }
    if (password !== confirm) { toast.error(t('setpw.mismatch')); return }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      toast.success(t('setpw.success'))
      navigate('/', { replace: true })
    } catch (err) {
      toast.error((err as Error).message ?? t('setpw.error'))
    } finally {
      setSaving(false)
    }
  }

  const showForm = loading || !!session

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.svg" alt="Geneva Disease Dynamics" className="w-48" />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('setpw.title')}</CardTitle>
            <CardDescription>{showForm ? t('setpw.desc') : t('setpw.invalid')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : session ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="pw">{t('setpw.password')}</Label>
                  <Input
                    id="pw"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pw2">{t('setpw.confirm')}</Label>
                  <Input
                    id="pw2"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t('setpw.submit')}
                </Button>
              </form>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => navigate('/login', { replace: true })}>
                {t('setpw.tologin')}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
