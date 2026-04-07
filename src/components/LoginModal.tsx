import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { playClick } from '../lib/sounds'

interface LoginModalProps {
  open: boolean
  onClose: () => void
  onLoggedIn?: () => void
}

/** Supabase sign-in / sign-up for bug reports only — not required to play. */
export function LoginModal({ open, onClose, onLoggedIn }: LoginModalProps) {
  const { login, signUp, ready, supabaseConfigured } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) {
      setEmail('')
      setPassword('')
      setError(null)
      setInfo(null)
      setMode('signin')
      setPending(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        playClick()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!supabaseConfigured) {
      setError('Supabase is not configured (missing URL or anon key in .env).')
      return
    }
    setPending(true)
    try {
      if (mode === 'signin') {
        const r = await login(email, password)
        if (!r.ok) {
          setError(r.error)
          setPending(false)
          return
        }
        playClick()
        onLoggedIn?.()
        onClose()
        setPending(false)
        return
      }
      const r = await signUp(email, password)
      if (!r.ok) {
        setError(r.error)
        setPending(false)
        return
      }
      playClick()
      if (r.needsEmailConfirmation) {
        setInfo(
          'Check your inbox to confirm your email, then sign in here. (You can disable confirmation in Supabase → Auth → Providers → Email for testing.)',
        )
        setMode('signin')
        setPassword('')
        setPending(false)
        return
      }
      onLoggedIn?.()
      onClose()
      setPending(false)
    } catch {
      setError('Something went wrong. Try again.')
      setPending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          playClick()
          onClose()
        }
      }}
    >
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="glass w-full max-w-sm rounded-3xl border border-white/12 p-6 shadow-2xl"
      >
        <h2 id="login-title" className="text-lg font-semibold text-white">
          {mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          {mode === 'signin' ? 'Sign in to save your scores and play multiplayer.' : 'Create an account to save your scores and play multiplayer.'}
        </p>

        {!supabaseConfigured && (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100/90">
            Set <code className="rounded bg-black/30 px-1">VITE_SUPABASE_URL</code> and{' '}
            <code className="rounded bg-black/30 px-1">VITE_SUPABASE_ANON_KEY</code> in{' '}
            <code className="rounded bg-black/30 px-1">.env</code>, run{' '}
            <code className="rounded bg-black/30 px-1">supabase/schema.sql</code>, then restart the
            dev server.
          </p>
        )}

        <div className="mt-4 flex rounded-xl border border-white/10 p-0.5">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                playClick()
                setMode(m)
                setError(null)
                setInfo(null)
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition ${
                mode === m
                  ? 'bg-cyan-500/25 text-cyan-100'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        {!ready && supabaseConfigured && (
          <p className="mt-3 text-center text-xs text-slate-500">Loading session…</p>
        )}

        <label className="mt-4 block text-xs uppercase tracking-wider text-slate-500">
          Email
        </label>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!ready}
          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:opacity-50"
          required
        />
        <label className="mt-3 block text-xs uppercase tracking-wider text-slate-500">
          Password
        </label>
        <input
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={!ready}
          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:opacity-50"
          minLength={6}
          required
        />
        {error && <p className="mt-2 text-xs text-amber-300/90">{error}</p>}
        {info && <p className="mt-2 text-xs text-emerald-200/90">{info}</p>}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => {
              playClick()
              onClose()
            }}
            className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm text-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !ready || !supabaseConfigured}
            className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40"
          >
            {pending ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </div>
      </form>
    </div>
  )
}
