import type { ContinentCode, PlaceCategory, PlaceRecord } from '../types/geo'
import { EXTRA_ALIAS_TARGETS } from './extraAliases'
import { firstChainLetter, normKey } from './normalize'

const CAT_PRIORITY: PlaceCategory[] = [
  'country',
  'territory',
  'city',
  'state',
  'island',
]

/** True if userInput (normalized) names this full name: exact match or first word(s) only. */
function isWholeWordPrefixOf(fullNorm: string, inputNorm: string): boolean {
  if (!inputNorm) return false
  if (fullNorm === inputNorm) return true
  return fullNorm.startsWith(inputNorm + ' ')
}

/**
 * If exactly one place in `categories` has canonical or alias matching `inputNorm`
 * as exact or whole-word prefix (input must end at a space boundary in the full name),
 * return it. "antigua" → "Antigua and Barbuda"; "north" → null (North Korea, North Macedonia, …).
 */
function resolveUnambiguousPrefix(
  inputNorm: string,
  records: readonly PlaceRecord[],
  selectedCategories: ReadonlySet<PlaceCategory>,
): PlaceRecord | null {
  const hits = new Map<string, PlaceRecord>()
  for (const p of records) {
    if (!selectedCategories.has(p.category)) continue
    const names = [p.canonical, ...(p.aliases ?? [])]
    for (const name of names) {
      const nk = normKey(name)
      if (!nk) continue
      if (isWholeWordPrefixOf(nk, inputNorm)) {
        hits.set(p.id, p)
        break
      }
    }
  }
  if (hits.size !== 1) return null
  for (const p of hits.values()) return p
  return null
}

export class PlaceIndex {
  readonly records: readonly PlaceRecord[]

  private byKey = new Map<string, PlaceRecord[]>()
  private byCanonical = new Map<string, PlaceRecord>()

  constructor(records: PlaceRecord[]) {
    this.records = records
    for (const p of records) {
      const cKey = normKey(p.canonical)
      this.pushKey(cKey, p)
      this.byCanonical.set(normKey(p.canonical), p)
      for (const a of p.aliases ?? []) {
        const ak = normKey(a)
        if (ak) this.pushKey(ak, p)
      }
    }
    for (const [k, canonical] of Object.entries(EXTRA_ALIAS_TARGETS)) {
      const target = this.byCanonical.get(normKey(canonical))
      if (target) this.pushKey(k, target)
    }
  }

  private pushKey(key: string, p: PlaceRecord) {
    if (!key) return
    const arr = this.byKey.get(key) ?? []
    if (!arr.some((x) => x.id === p.id)) arr.push(p)
    this.byKey.set(key, arr)
  }

  /** Resolve text to a place allowed by category (continents checked separately). */
  resolve(raw: string, selectedCategories: ReadonlySet<PlaceCategory>): PlaceRecord | null {
    const key = normKey(raw)
    if (!key) return null
    let matches = this.byKey.get(key) ?? []
    if (matches.length === 0) {
      const viaExtra = EXTRA_ALIAS_TARGETS[key]
      if (viaExtra) {
        const t = this.byCanonical.get(normKey(viaExtra))
        if (t) matches = [t]
      }
    }
    const pool = matches.filter((m) => selectedCategories.has(m.category))
    if (pool.length) {
      pool.sort(
        (a, b) => CAT_PRIORITY.indexOf(a.category) - CAT_PRIORITY.indexOf(b.category),
      )
      return pool[0] ?? null
    }

    return resolveUnambiguousPrefix(key, this.records, selectedCategories)
  }
}

export function validateAnswer(
  place: PlaceRecord,
  requiredStart: string | null,
  selectedCategories: ReadonlySet<PlaceCategory>,
  selectedContinents: ReadonlySet<ContinentCode> | null,
  usedIds: ReadonlySet<string>,
): { ok: true } | { ok: false; reason: string } {
  if (!selectedCategories.has(place.category)) {
    return { ok: false, reason: 'That type of place is turned off for this round.' }
  }
  if (selectedContinents && selectedContinents.size > 0) {
    const ok = place.continents.some((c) => selectedContinents.has(c))
    if (!ok) return { ok: false, reason: 'Not in your selected continents.' }
  }
  if (usedIds.has(place.id)) {
    return { ok: false, reason: 'Already played — pick somewhere new.' }
  }
  if (requiredStart) {
    const fl = firstChainLetter(place.canonical)
    if (fl !== requiredStart.toLowerCase()) {
      return {
        ok: false,
        reason: `Needs to start with “${requiredStart.toUpperCase()}”.`,
      }
    }
  }
  return { ok: true }
}
