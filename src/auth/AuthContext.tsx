import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient'

export type BugReporterUser = { id: string; email: string }

type AuthContextValue = {
  user: BugReporterUser | null
  /** True after first auth session check (Supabase or “no backend”). */
  ready: boolean
  supabaseConfigured: boolean
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  signUp: (
    email: string,
    password: string,
  ) => Promise<
    { ok: true; needsEmailConfirmation: boolean } | { ok: false; error: string }
  >
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<BugReporterUser | null>(null)
  const [ready, setReady] = useState(false)
  const supabaseConfigured = isSupabaseConfigured()

  useEffect(() => {
    const sb = getSupabase()
    if (!sb) {
      setReady(true)
      return
    }

    const mapSession = (u: { id: string; email?: string | null } | null) => {
      if (!u?.email) {
        setUser(null)
        return
      }
      setUser({ id: u.id, email: u.email })
    }

    sb.auth.getSession().then(({ data: { session } }) => {
      mapSession(session?.user ?? null)
      setReady(true)
    })

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      mapSession(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const sb = getSupabase()
      if (!sb) {
        return {
          ok: false as const,
          error:
            'Reporting is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.',
        }
      }
      const { error } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) return { ok: false as const, error: error.message }
      return { ok: true as const }
    },
    [],
  )

  const signUp = useCallback(
    async (email: string, password: string) => {
      const sb = getSupabase()
      if (!sb) {
        return {
          ok: false as const,
          error:
            'Reporting is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
        }
      }
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
      })
      if (error) return { ok: false as const, error: error.message }
      const needsEmailConfirmation = !data.session
      return { ok: true as const, needsEmailConfirmation }
    },
    [],
  )

  const logout = useCallback(async () => {
    const sb = getSupabase()
    if (sb) await sb.auth.signOut()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      supabaseConfigured,
      login,
      signUp,
      logout,
    }),
    [user, ready, supabaseConfigured, login, signUp, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
