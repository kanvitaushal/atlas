import type { ContinentCode, PlaceCategory } from './types/geo'

export const CATEGORY_OPTIONS: { id: PlaceCategory; label: string }[] = [
  { id: 'country', label: 'Countries' },
  { id: 'city', label: 'Cities' },
  { id: 'state', label: 'States' },
  { id: 'territory', label: 'Territories' },
  { id: 'island', label: 'Islands' },
]

export const CONTINENT_OPTIONS: { id: ContinentCode; label: string }[] = [
  { id: 'AF', label: 'Africa' },
  { id: 'AN', label: 'Antarctica' },
  { id: 'AS', label: 'Asia' },
  { id: 'EU', label: 'Europe' },
  { id: 'NA', label: 'North America' },
  { id: 'OC', label: 'Oceania' },
  { id: 'SA', label: 'South America' },
]

export const DEFAULT_TIMER_SEC = 45

/** Seconds per turn when timer is on (user-pickable). */
export const TIMER_LIMIT_OPTIONS = [15, 30, 45, 60, 90, 120] as const
