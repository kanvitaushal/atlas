import type { ContinentCode, PlaceCategory, PlaceRecord } from '../types/geo'
import { firstChainLetter, lettersChainFromEnd } from './normalize'

export function hasPlayableForLetter(
  records: readonly PlaceRecord[],
  letter: string,
  categories: ReadonlySet<PlaceCategory>,
  continentSet: ReadonlySet<ContinentCode> | null,
  usedIds: ReadonlySet<string>,
): boolean {
  const need = letter.toLowerCase()
  return records.some((p) => {
    if (!categories.has(p.category)) return false
    if (usedIds.has(p.id)) return false
    if (continentSet && continentSet.size > 0) {
      if (!p.continents.some((c) => continentSet.has(c))) return false
    }
    return firstChainLetter(p.canonical) === need
  })
}

/** If the last letter has no unused answers, try the second-to-last, then earlier letters. */
export function pickNextRequiredLetter(
  prevCanonical: string,
  records: readonly PlaceRecord[],
  categories: ReadonlySet<PlaceCategory>,
  continentSet: ReadonlySet<ContinentCode> | null,
  usedIds: ReadonlySet<string>,
): string | null {
  const letters = lettersChainFromEnd(prevCanonical)
  if (letters.length === 0) return null
  for (const L of letters) {
    if (hasPlayableForLetter(records, L, categories, continentSet, usedIds)) return L
  }
  return letters[0]
}

/** Any unused place that satisfies category / continent filters (first turn: any letter). */
export function hasAnyLegalMove(
  requiredStart: string | null,
  records: readonly PlaceRecord[],
  categories: ReadonlySet<PlaceCategory>,
  continentSet: ReadonlySet<ContinentCode> | null,
  usedIds: ReadonlySet<string>,
): boolean {
  if (requiredStart === null) {
    return records.some((p) => {
      if (!categories.has(p.category)) return false
      if (usedIds.has(p.id)) return false
      if (continentSet && continentSet.size > 0) {
        if (!p.continents.some((c) => continentSet.has(c))) return false
      }
      return true
    })
  }
  return hasPlayableForLetter(
    records,
    requiredStart,
    categories,
    continentSet,
    usedIds,
  )
}

export function pickBotPlace(
  records: readonly PlaceRecord[],
  requiredStart: string | null,
  categories: ReadonlySet<PlaceCategory>,
  continentSet: ReadonlySet<ContinentCode> | null,
  usedIds: ReadonlySet<string>,
): PlaceRecord | null {
  const need = requiredStart?.toLowerCase() ?? null
  const candidates = records.filter((p) => {
    if (!categories.has(p.category)) return false
    if (usedIds.has(p.id)) return false
    if (continentSet && continentSet.size > 0) {
      if (!p.continents.some((c) => continentSet.has(c))) return false
    }
    if (need) {
      if (firstChainLetter(p.canonical) !== need) return false
    }
    return true
  })
  if (!candidates.length) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}
