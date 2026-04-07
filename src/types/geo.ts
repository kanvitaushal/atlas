export type PlaceCategory = 'country' | 'city' | 'state' | 'territory' | 'island'

export type ContinentCode = 'AF' | 'AN' | 'AS' | 'EU' | 'NA' | 'OC' | 'SA'

export interface PlaceRecord {
  id: string
  canonical: string
  category: PlaceCategory
  continents: ContinentCode[]
  aliases?: string[]
  countryCode?: string
}
