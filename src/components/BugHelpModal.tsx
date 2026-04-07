import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { submitBugReport } from '../lib/submitBugReport'
import { playClick } from '../lib/sounds'
import { LoginModal } from './LoginModal'

interface BugHelpModalProps {
  open: boolean
  onClose: () => void
}

export function BugHelpModal({ open, onClose }: BugHelpModalProps) {
  const { user, logout, supabaseConfigured, ready } = useAuth()
  const [loginOpen, setLoginOpen] = useState(false)
  const [report, setReport] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setFeedback(null)
      setReport('')
      setLoginOpen(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loginOpen) {
        playClick()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, loginOpen])

  if (!open) return null

  const handleSubmitReport = async () => {
    if (!user) return
    setFeedback(null)
    setSubmitting(true)
    try {
      const r = await submitBugReport(user, report)
      setSubmitting(false)
      if (r.kind === 'error') {
        setFeedback(r.message)
        return
      }
      setFeedback('Thanks — your report was saved.')
      setReport('')
    } catch {
      setSubmitting(false)
      setFeedback('Something went wrong. Try again.')
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-help-title"
        onClick={(e) => {
          if (e.target === e.currentTarget && !loginOpen) {
            playClick()
            onClose()
          }
        }}
      >
        <div className="glass max-h-[min(90vh,40rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/12 p-6 text-left shadow-2xl">
          <h2
            id="bug-help-title"
            className="text-xl font-semibold tracking-tight text-white"
          >
            Found a glitch in the matrix?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            A lot of “glitches” are really naming quirks or filters. Here’s what trips people up —
            including the{' '}
            <span className="text-cyan-200/90">DRC / Congo</span> situation.
          </p>

          <ul className="mt-5 space-y-4 text-sm leading-relaxed text-slate-300">
            <li>
              <span className="font-medium text-cyan-100/90">Two different Congos</span>
              <br />
              <span className="text-slate-400">
                <strong className="text-slate-300">Republic of the Congo</strong> (capital
                Brazzaville) is not the same country as{' '}
                <strong className="text-slate-300">DR Congo</strong> (Democratic Republic of the
                Congo, capital Kinshasa). People often say “Congo” for both — the game uses full
                names and aliases like <strong className="text-slate-300">DRC</strong> for the big
                one. If an answer fails, check you meant the right Congo and that Countries (or your
                chosen types) are enabled.
              </span>
            </li>
            <li>
              <span className="font-medium text-cyan-100/90">Hyphens vs spaces</span>
              <br />
              <span className="text-slate-400">
                Spelling like <strong className="text-slate-300">Timor-Leste</strong> vs{' '}
                <strong className="text-slate-300">Timor Leste</strong> is treated the same — you
                shouldn’t lose a point over a hyphen.
              </span>
            </li>
            <li>
              <span className="font-medium text-cyan-100/90">Short first words</span>
              <br />
              <span className="text-slate-400">
                Words like <strong className="text-slate-300">North</strong>,{' '}
                <strong className="text-slate-300">South</strong>, or{' '}
                <strong className="text-slate-300">New</strong> match many places. The game only
                auto-fills a short name when it’s unambiguous — type more letters or the full name
                if it won’t accept.
              </span>
            </li>
            <li>
              <span className="font-medium text-cyan-100/90">Place types & continents</span>
              <br />
              <span className="text-slate-400">
                If “Countries” (or another type) is off, that place won’t count. Continent filters
                work the same. Use <strong className="text-slate-300">Reference atlas</strong> to
                see exactly how a place is listed.
              </span>
            </li>
          </ul>

          <p className="mt-6 border-t border-white/10 pt-4 text-sm text-slate-500">
            Still seeing a real glitch? Report your issue below after signing in — it goes to a
            database only you (the host) need to read.
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <h3 className="text-sm font-medium text-cyan-100/90">Report your issue</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              <strong className="text-slate-400">Playing does not require an account.</strong>{' '}
              Sign in only to submit a report (stored in Supabase with your user id).
            </p>

            {!ready && supabaseConfigured && (
              <p className="mt-3 text-xs text-slate-500">Connecting…</p>
            )}

            {!supabaseConfigured && (
              <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100/90">
                Bug database not connected. Add <code className="rounded bg-black/30 px-1">VITE_SUPABASE_URL</code> and{' '}
                <code className="rounded bg-black/30 px-1">VITE_SUPABASE_ANON_KEY</code> to{' '}
                <code className="rounded bg-black/30 px-1">.env</code>, run{' '}
                <code className="rounded bg-black/30 px-1">supabase/schema.sql</code> in the Supabase
                SQL editor, then restart the app.
              </p>
            )}

            {!user ? (
              <button
                type="button"
                disabled={!supabaseConfigured || !ready}
                onClick={() => {
                  playClick()
                  setLoginOpen(true)
                }}
                className="mt-4 w-full rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sign in to report
              </button>
            ) : (
              <>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>
                    Signed in as <span className="text-slate-300">{user.email}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      playClick()
                      void logout()
                      setFeedback(null)
                    }}
                    className="text-cyan-400/90 underline decoration-cyan-500/40 hover:text-cyan-300"
                  >
                    Sign out
                  </button>
                </p>
                <label htmlFor="bug-report-body" className="mt-3 block text-xs text-slate-500">
                  What went wrong?
                </label>
                <textarea
                  id="bug-report-body"
                  value={report}
                  onChange={(e) => setReport(e.target.value)}
                  rows={4}
                  placeholder="What did you type? What happened vs what you expected? (Browser, solo vs two players, categories.)"
                  className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                />
                {feedback && (
                  <p className="mt-2 text-xs text-emerald-200/90">{feedback}</p>
                )}
                <button
                  type="button"
                  disabled={submitting || !report.trim() || !supabaseConfigured}
                  onClick={() => void handleSubmitReport()}
                  className="mt-3 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? 'Sending…' : 'Submit report'}
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              playClick()
              onClose()
            }}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/25"
          >
            Close
          </button>
        </div>
      </div>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLoggedIn={() => setFeedback(null)}
      />
    </>
  )
}
