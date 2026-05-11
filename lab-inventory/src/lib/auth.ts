import { useEffect, useState, createContext, useContext } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile } from '@/types/database'

interface AuthState {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
}

export const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  session: null,
  loading: true,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function useAuthState(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

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
      else { setProfile(null); setLoading(false) }
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

  return { user, profile, session, loading }
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
  return profile?.role === 'admin' || profile?.role === 'lab_manager' || profile?.role === 'tech'
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  lab_manager: 'Lab Manager',
  supervisor: 'Supervisor',
  tech: 'Lab Tech',
}
