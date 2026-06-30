import { supabase } from './supabase'

// Calls the server-side /api/admin-users function with the current user's
// access token. The function holds the service-role key and enforces that
// the caller is an admin.
async function callAdmin<T = unknown>(action: string, payload: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not authenticated')

  const res = await fetch('/api/admin-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error || `Request failed (${res.status})`)
  return json as T
}

export function inviteUser(p: { email: string; full_name: string; role: string; redirectTo: string }) {
  return callAdmin('invite', p)
}

export function setUserActive(p: { id: string; is_active: boolean }) {
  return callAdmin('set_active', p)
}

export function setUserPassword(p: { id: string; password: string }) {
  return callAdmin('set_password', p)
}
