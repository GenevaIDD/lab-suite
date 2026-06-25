import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile, UserRole } from '@/types/database'

interface AuthState {
  user: User | null
  profile: Profile | null        // effective profile — role may be overridden by "view as"
  realProfile: Profile | null    // the actual signed-in profile (never overridden)
  session: Session | null
  loading: boolean
  viewAsRole: UserRole | null     // non-null while an admin previews another role
  setViewAsRole: (role: UserRole | null) => void
}

export const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  realProfile: null,
  session: null,
  loading: true,
  viewAsRole: null,
  setViewAsRole: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function useAuthState(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewAsRole, setViewAsRole] = useState<UserRole | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) fetchProfile(data.session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setViewAsRole(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  // Only a real admin may impersonate. The override changes role only — id,
  // name, email stay real, and the server still enforces the real JWT (this is
  // a UI preview, not a privilege change).
  const isRealAdmin = profile?.role === 'admin'
  const effectiveViewAs = isRealAdmin ? viewAsRole : null
  const effectiveProfile: Profile | null =
    profile && effectiveViewAs ? { ...profile, role: effectiveViewAs } : profile

  const setViewAs = useCallback((role: UserRole | null) => setViewAsRole(role), [])

  return {
    user,
    profile: effectiveProfile,
    realProfile: profile,
    session,
    loading,
    viewAsRole: effectiveViewAs,
    setViewAsRole: setViewAs,
  }
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function canWrite(profile: Profile | null): boolean {
  return profile?.role === 'admin' || profile?.role === 'lab_manager'
}

export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === 'admin'
}

export function canEnterData(profile: Profile | null): boolean {
  return profile?.role === 'admin' || profile?.role === 'lab_manager' || profile?.role === 'tech' || profile?.role === 'lab_team'
}

export function canManageStock(profile: Profile | null): boolean {
  return profile?.role === 'admin' || profile?.role === 'lab_manager' || profile?.role === 'tech'
}

// Only admins can view/manage users and change roles.
export function canManageUsers(profile: Profile | null): boolean {
  return profile?.role === 'admin'
}

// Assignable roles, in display order. Source of truth for the role picker.
export const ROLES = ['admin', 'lab_manager', 'tech', 'lab_team'] as const

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  lab_manager: 'Responsable de labo',
  tech: 'Technicien',
  lab_team: 'Équipe de labo',
}
