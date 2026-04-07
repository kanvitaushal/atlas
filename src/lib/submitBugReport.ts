import type { BugReporterUser } from '../auth/AuthContext'
import { getSupabase } from './supabaseClient'

export type SubmitBugResult =
  | { kind: 'ok' }
  | { kind: 'error'; message: string }

export async function submitBugReport(
  user: BugReporterUser,
  message: string,
): Promise<SubmitBugResult> {
  const trimmed = message.trim()
  if (!trimmed) return { kind: 'error', message: 'Please describe the issue.' }

  const sb = getSupabase()
  if (!sb) {
    return {
      kind: 'error',
      message:
        'Database not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and run supabase/schema.sql.',
    }
  }

  const { error } = await sb.from('bug_reports').insert({
    user_id: user.id,
    email: user.email,
    message: trimmed,
  })

  if (error) {
    return {
      kind: 'error',
      message:
        error.message ||
        'Could not save report. Check the bug_reports table and RLS policies in Supabase.',
    }
  }

  return { kind: 'ok' }
}
