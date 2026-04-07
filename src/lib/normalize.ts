/**
 * Lowercase, strip diacritics, collapse spaces — for matching user input to aliases.
 * Hyphens / dashes / slashes / underscores become spaces first so "Timor-Leste" and
 * "Timor Leste" both normalize to "timor leste".
 */
export function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\-_/]+/g, ' ')
    .replace(/[\u2010-\u2015]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Last Latin letter in a string (for chain rule). */
export function lastChainLetter(s: string): string {
  const letters = lettersChainFromEnd(s)
  return letters[0] ?? ''
}

/** Latin letters from last to first (last, second-to-last, …). */
export function lettersChainFromEnd(s: string): string[] {
  const t = s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
  const out: string[] = []
  for (let i = t.length - 1; i >= 0; i--) {
    const c = t[i]
    if (c >= 'a' && c <= 'z') out.push(c)
  }
  return out
}

/** First Latin letter of canonical name. */
export function firstChainLetter(s: string): string {
  const t = s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (c >= 'a' && c <= 'z') return c
  }
  return ''
}
