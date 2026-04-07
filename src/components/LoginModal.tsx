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
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setEmail('')
      setPassword('')
      setName('')
      setCountry('')
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
      if (!name.trim() || !country.trim()) {
        setError('Please fill in all fields')
        setPending(false)
        return
      }
      const r = await signUp(email, password, name.trim(), country.trim())
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
        setName('')
        setCountry('')
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
        
        {mode === 'signup' && (
          <>
            <label className="mt-3 block text-xs uppercase tracking-wider text-slate-500">
              Name
            </label>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!ready}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:opacity-50"
              required
            />
            
            <label className="mt-3 block text-xs uppercase tracking-wider text-slate-500">
              Country
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={!ready}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:opacity-50"
              required
            >
              <option value="">Select a country</option>
              <option value="US">United States</option>
              <option value="UK">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
              <option value="IN">India</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="JP">Japan</option>
              <option value="BR">Brazil</option>
              <option value="MX">Mexico</option>
              <option value="ES">Spain</option>
              <option value="IT">Italy</option>
              <option value="NL">Netherlands</option>
              <option value="SE">Sweden</option>
              <option value="NO">Norway</option>
              <option value="DK">Denmark</option>
              <option value="FI">Finland</option>
              <option value="CH">Switzerland</option>
              <option value="AT">Austria</option>
              <option value="BE">Belgium</option>
              <option value="IE">Ireland</option>
              <option value="PT">Portugal</option>
              <option value="GR">Greece</option>
              <option value="TR">Turkey</option>
              <option value="IL">Israel</option>
              <option value="AE">United Arab Emirates</option>
              <option value="SA">Saudi Arabia</option>
              <option value="EG">Egypt</option>
              <option value="ZA">South Africa</option>
              <option value="NG">Nigeria</option>
              <option value="KE">Kenya</option>
              <option value="RU">Russia</option>
              <option value="CN">China</option>
              <option value="KR">South Korea</option>
              <option value="SG">Singapore</option>
              <option value="MY">Malaysia</option>
              <option value="TH">Thailand</option>
              <option value="PH">Philippines</option>
              <option value="ID">Indonesia</option>
              <option value="NZ">New Zealand</option>
              <option value="Other">Other</option>
            </select>
          </>
        )}
        
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
