import type { ContinentCode, PlaceCategory, PlaceRecord } from '../types/geo'

const DATA_BASE = `${import.meta.env.BASE_URL}data/`.replace(/\/+/g, '/')

async function fetchPlaces(path: string): Promise<PlaceRecord[]> {
  const res = await fetch(`${DATA_BASE}${path}`)
  if (!res.ok) throw new Error(`Failed to load ${path}`)
  const data = (await res.json()) as PlaceRecord[]
  return data.map((p) => ({
    ...p,
    continents: p.continents as ContinentCode[],
  }))
}

export async function loadDataset(categories: ReadonlySet<PlaceCategory>): Promise<PlaceRecord[]> {
  const out: PlaceRecord[] = []

  if (categories.has('country') || categories.has('territory')) {
    const all = await fetchPlaces('countries.json')
    for (const p of all) {
      if (categories.has(p.category)) out.push(p)
    }
  }
  if (categories.has('state')) {
    out.push(...(await fetchPlaces('states.json')))
  }
  if (categories.has('city')) {
    out.push(...(await fetchPlaces('cities.json')))
  }
  if (categories.has('island')) {
    out.push(...(await fetchPlaces('islands.json')))
  }

  return out
}

/** Full dataset for the reference Atlas (all categories). */
export async function loadFullAtlas(): Promise<PlaceRecord[]> {
  const [countries, states, cities, islands] = await Promise.all([
    fetchPlaces('countries.json'),
    fetchPlaces('states.json'),
    fetchPlaces('cities.json'),
    fetchPlaces('islands.json'),
  ])
  return [...countries, ...states, ...cities, ...islands]
}
