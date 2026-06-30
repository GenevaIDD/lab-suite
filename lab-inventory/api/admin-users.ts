// Vercel serverless function — privileged user management.
//
// Holds the Supabase SERVICE-ROLE key (server-only secret) and performs
// auth-admin operations the browser cannot: inviting users and
// deactivating/reactivating (banning) them. Every request is verified to
// come from a signed-in admin before anything happens.
//
// Required Vercel environment variables (Project → Settings → Environment):
//   SUPABASE_URL                — your project URL (or reuses VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY   — service role key (NEVER expose to the client)
//
// Also add "<your-app-url>/set-password" to Supabase Auth → URL Configuration
// → Redirect URLs so invite links land on the set-password page.

import { createClient } from '@supabase/supabase-js'

interface Req {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body: unknown
}
interface Res {
  status(code: number): Res
  json(body: unknown): void
}

const BAN_FOREVER = '876600h' // ~100 years

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!url || !serviceKey) {
    return res.status(500).json({ error: 'Server not configured (missing SUPABASE_SERVICE_ROLE_KEY)' })
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // 1. Authenticate the caller from their bearer token.
  const authHeader = (req.headers['authorization'] ?? req.headers['Authorization']) as string | undefined
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Missing authorization token' })

  const { data: caller, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller.user) return res.status(401).json({ error: 'Invalid session' })

  // 2. Caller must be an admin.
  const { data: callerProfile, error: profileErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.user.id)
    .single()
  if (profileErr || !callerProfile) {
    // With a correct service_role key this read bypasses RLS and always
    // returns the row. Failing here almost always means the configured key
    // is the anon key (RLS then hides the row), not the service_role key.
    return res.status(403).json({
      error: `Could not read your profile — confirm SUPABASE_SERVICE_ROLE_KEY is the service_role (secret) key, not the anon key, and that you redeployed. (${profileErr?.message ?? 'no row found'})`,
    })
  }
  if (callerProfile.role !== 'admin') {
    return res.status(403).json({ error: `Admin access required — your account role is "${callerProfile.role}"` })
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const action = body.action

  try {
    if (action === 'invite') {
      const email = String(body.email ?? '').trim().toLowerCase()
      const fullName = String(body.full_name ?? '').trim()
      const role = String(body.role ?? 'tech')
      const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined
      if (!email) return res.status(400).json({ error: 'Email is required' })
      if (!['admin', 'lab_manager', 'tech', 'lab_team'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' })
      }

      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo,
      })
      if (error) return res.status(400).json({ error: error.message })

      // The handle_new_user trigger creates the profile row; set role/name.
      const newId = data.user?.id
      if (newId) {
        await admin.from('profiles').update({ full_name: fullName, role, is_active: true }).eq('id', newId)
      }
      return res.status(200).json({ ok: true, id: newId })
    }

    if (action === 'set_active') {
      const id = String(body.id ?? '')
      const isActive = Boolean(body.is_active)
      if (!id) return res.status(400).json({ error: 'User id is required' })
      if (id === caller.user.id && !isActive) {
        return res.status(400).json({ error: 'You cannot deactivate your own account' })
      }

      const { error } = await admin.auth.admin.updateUserById(id, {
        ban_duration: isActive ? 'none' : BAN_FOREVER,
      })
      if (error) return res.status(400).json({ error: error.message })

      await admin.from('profiles').update({ is_active: isActive }).eq('id', id)
      return res.status(200).json({ ok: true })
    }

    if (action === 'set_password') {
      const id = String(body.id ?? '')
      const password = String(body.password ?? '')
      if (!id) return res.status(400).json({ error: 'User id is required' })
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

      // email_confirm: true also activates an invited-but-unconfirmed user, so
      // someone whose invite link expired can sign in immediately with this password.
      const { error } = await admin.auth.admin.updateUserById(id, {
        password,
        email_confirm: true,
      })
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
