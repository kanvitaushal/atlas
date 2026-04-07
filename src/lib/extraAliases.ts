import { normKey } from './normalize'

const PAIRS: [string, string][] = [
  ['USA', 'United States'],
  ['America', 'United States'],
  ['UK', 'United Kingdom'],
  ['Britain', 'United Kingdom'],
  ['England', 'United Kingdom'],
  ['Holland', 'Netherlands'],
  ['Burma', 'Myanmar'],
  ['Czechia', 'Czechia'],
  ['Ivory Coast', "Côte d'Ivoire"],
  ['East Timor', 'Timor-Leste'],
  ['The USA', 'United States'],
  ['The UK', 'United Kingdom'],
  // Common English variants for the two Congos (dataset uses these canon names)
  ['Republic of Congo', 'Republic of the Congo'],
  ['Congo Republic', 'Republic of the Congo'],
  ['Democratic Republic of Congo', 'DR Congo'],
  ['Democratic Republic of the Congo', 'DR Congo'],
  ['DRC', 'DR Congo'],
]

/** Normalized lookup key → canonical country name (merged at index build). */
export const EXTRA_ALIAS_TARGETS: Record<string, string> = Object.fromEntries(
  PAIRS.map(([alias, target]) => [normKey(alias), target]),
)

/** Human-readable extra aliases (for Atlas) that resolve to this canonical. */
export function displayExtraAliasesForCanonical(canonical: string): string[] {
  return PAIRS.filter(([, t]) => normKey(t) === normKey(canonical)).map(([a]) => a)
}
