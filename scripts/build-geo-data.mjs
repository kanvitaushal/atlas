/**
 * Fetches and normalizes geography datasets into public/data/*.json
 * Run: npm run build:data
 */
import AdmZip from 'adm-zip'
import { mkdirSync, writeFileSync } from 'fs'
import { get } from 'https'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'data')

const CONTINENTS = ['AF', 'AN', 'AS', 'EU', 'NA', 'OC', 'SA']

/** @type {Record<string, string[]>} */
const MULTI_CONTINENT = {
  RUS: ['EU', 'AS'],
  TUR: ['EU', 'AS'],
  CYP: ['EU', 'AS'],
  KAZ: ['EU', 'AS'],
  GEO: ['EU', 'AS'],
  AZE: ['EU', 'AS'],
  ARM: ['EU', 'AS'],
  EGY: ['AF', 'AS'],
  IDN: ['AS', 'OC'],
  PAN: ['NA', 'SA'],
  USA: ['NA', 'OC'],
  NOR: ['EU', 'NA', 'AN'],
  AUS: ['OC', 'AS'],
  NZL: ['OC', 'AS'],
  CHL: ['SA', 'OC'],
  COL: ['SA', 'NA'],
  VEN: ['SA', 'NA'],
  ECU: ['SA', 'NA'],
}

/** Extra aliases (lowercase key -> canonical display name) */
const EXTRA_ALIASES = {
  usa: 'United States',
  'u.s.a.': 'United States',
  america: 'United States',
  uk: 'United Kingdom',
  britain: 'United Kingdom',
  greatbritain: 'United Kingdom',
  england: 'United Kingdom',
  scotland: 'United Kingdom',
  wales: 'United Kingdom',
  'ivory coast': "Côte d'Ivoire",
  'cote divoire': "Côte d'Ivoire",
  'east timor': 'Timor-Leste',
  easttimor: 'Timor-Leste',
  holland: 'Netherlands',
  burma: 'Myanmar',
  czechia: 'Czechia',
  macedonia: 'North Macedonia',
  swaziland: 'Eswatini',
  congo: 'Republic of the Congo',
  drcongo: 'DR Congo',
  palestine: 'Palestine',
  taiwan: 'Taiwan',
  kosovo: 'Kosovo',
}

/** Island places: [canonical, continents] */
const ISLAND_DATA = [
  ['Greenland', ['NA']],
  ['Madagascar', ['AF']],
  ['Borneo', ['AS']],
  ['New Guinea', ['OC', 'AS']],
  ['Honshu', ['AS']],
  ['Great Britain', ['EU']],
  ['Ireland', ['EU']],
  ['Java', ['AS']],
  ['Luzon', ['AS']],
  ['Mindanao', ['AS']],
  ['Sumatra', ['AS']],
  ['Cuba', ['NA']],
  ['Hispaniola', ['NA']],
  ['Sri Lanka', ['AS']],
  ['Tasmania', ['OC']],
  ['Iceland', ['EU']],
  ['Sicily', ['EU']],
  ['Sardinia', ['EU']],
  ['Hokkaido', ['AS']],
  ['Kyushu', ['AS']],
  ['Shikoku', ['AS']],
  ['Newfoundland', ['NA']],
  ['Vancouver Island', ['NA']],
  ['Manhattan', ['NA']],
  ['Long Island', ['NA']],
  ['Galápagos Islands', ['SA']],
  ['Fiji', ['OC']],
  ['Tahiti', ['OC']],
  ['Bali', ['AS']],
  ['Canary Islands', ['AF']],
  ['Azores', ['EU']],
  ['Madeira', ['EU']],
  ['Corsica', ['EU']],
  ['Crete', ['EU']],
  ['Maldives', ['AS']],
  ['Bahamas', ['NA']],
  ['Barbados', ['NA']],
  ['Jamaica', ['NA']],
  ['Trinidad', ['NA']],
  ['Mauritius', ['AF']],
  ['Reunion', ['AF']],
  ['Zanzibar', ['AF']],
  ['Faroe Islands', ['EU']],
  ['Svalbard', ['EU']],
  ['Easter Island', ['OC']],
  ['Baffin Island', ['NA']],
  ['Victoria Island', ['NA']],
  ['Ellesmere Island', ['NA']],
  ['Hawaiian Islands', ['OC']],
  ["Martha's Vineyard", ['NA']],
  ['Nantucket', ['NA']],
  ['Prince Edward Island', ['NA']],
  ['Antigua', ['NA']],
  ['Guam', ['OC']],
  ['Saipan', ['OC']],
  ['Palawan', ['AS']],
  ['Jeju', ['AS']],
  ['Phuket', ['AS']],
  ['Capri', ['EU']],
  ['Ibiza', ['EU']],
  ['Mallorca', ['EU']],
  ['Malta', ['EU']],
  ['Isle of Man', ['EU']],
  ['Jersey', ['EU']],
  ['Guernsey', ['EU']],
  ['Anglesey', ['EU']],
  ['Skye', ['EU']],
  ['Lewis and Harris', ['EU']],
  ['Maui', ['OC']],
  ['Oahu', ['OC']],
  ['Kauai', ['OC']],
  ['Big Island', ['OC']],
  ['Saint Lucia', ['NA']],
  ['Saint Vincent', ['NA']],
  ['Grenada', ['NA']],
  ['Dominica', ['NA']],
  ['Cayman Islands', ['NA']],
  ['Turks and Caicos Islands', ['NA']],
  ['British Virgin Islands', ['NA']],
  ['US Virgin Islands', ['NA']],
  ['Aruba', ['NA']],
  ['Curaçao', ['NA']],
  ['Bermuda', ['NA']],
  ['Falkland Islands', ['SA']],
  ['South Georgia', ['SA', 'AN']],
  ['Tierra del Fuego', ['SA']],
]

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location
        if (!loc) return reject(new Error('Redirect without location'))
        return resolve(fetchJson(loc.startsWith('http') ? loc : new URL(loc, url).href))
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch (e) {
          reject(e)
        }
      })
    }).on('error', reject)
  })
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location
        if (!loc) return reject(new Error('Redirect without location'))
        return resolve(fetchBuffer(loc.startsWith('http') ? loc : new URL(loc, url).href))
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
}

function slug(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function normKey(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function regionToContinents(region, subregion, cca3) {
  if (MULTI_CONTINENT[cca3]) return [...MULTI_CONTINENT[cca3]]
  const r = region || ''
  const sr = (subregion || '').toLowerCase()
  if (r === 'Africa') return ['AF']
  if (r === 'Antarctic') return ['AN']
  if (r === 'Asia') return ['AS']
  if (r === 'Europe') return ['EU']
  if (r === 'Oceania') return ['OC']
  if (r === 'Americas') {
    if (sr.includes('south')) return ['SA']
    return ['NA']
  }
  return ['AS']
}

function isSovereignOrRecognized(c) {
  const cca3 = c.cca3
  const common = (c.name?.common || '').toLowerCase()
  if (c.independent !== false) return true
  if (cca3 === 'PSE' || cca3 === 'TWN') return true
  if (cca3 === 'UNK' && common.includes('kosovo')) return true
  if (common === 'kosovo') return true
  return false
}

async function buildCountries() {
  const raw = await fetchJson(
    'https://restcountries.com/v3.1/all?fields=name,cca2,cca3,altSpellings,region,subregion,independent,status'
  )
  /** @type {import('../src/types/geo').PlaceRecord[]} */
  const places = []
  /** @type {Map<string, string[]>} */
  const countryContinents = new Map()

  for (const c of raw) {
    const cca3 = c.cca3
    const cca2 = c.cca2
    const common = c.name?.common || ''
    const official = c.name?.official || ''
    if (!common || !cca3 || !cca2) continue

    const continents = regionToContinents(c.region, c.subregion, cca3)
    countryContinents.set(cca3, continents)
    countryContinents.set(cca2, continents)

    const aliases = new Set()
    for (const a of c.altSpellings || []) {
      if (a && a.length < 80) aliases.add(a)
    }
    if (official && official !== common) aliases.add(official)
    for (const [, v] of Object.entries(EXTRA_ALIASES)) {
      if (normKey(v) === normKey(common)) aliases.add(v)
    }

    const category = isSovereignOrRecognized(c) ? 'country' : 'territory'

    places.push({
      id: `c-${slug(cca3)}`,
      canonical: common,
      category,
      continents: [...new Set(continents)].sort(),
      aliases: [...aliases],
      countryCode: cca2,
    })
  }

  return { places, countryContinents }
}

async function buildStates(countryContinents) {
  const url =
    'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/states.json'
  let states
  try {
    states = await fetchJson(url)
  } catch {
    console.warn('states.json fetch failed, skipping states')
    return []
  }
  /** @type {import('../src/types/geo').PlaceRecord[]} */
  const out = []
  for (const s of states) {
    const name = s.name
    const code = s.country_code
    if (!name || !code) continue
    const cc = code.toUpperCase()
    let continents = countryContinents.get(cc)
    if (!continents) {
      continents = ['AS', 'EU', 'AF', 'NA', 'SA', 'OC', 'AN']
    }
    out.push({
      id: `s-${slug(`${cc}-${name}-${s.id ?? ''}`)}`,
      canonical: name,
      category: 'state',
      continents: [...continents],
      aliases: s.state_code ? [String(s.state_code)] : [],
      countryCode: cc,
    })
  }
  return out
}

async function buildCities(countryContinents) {
  const buf = await fetchBuffer('https://download.geonames.org/export/dump/cities15000.zip')
  const zip = new AdmZip(buf)
  const entry = zip.getEntry('cities15000.txt')
  if (!entry) {
    console.warn('cities15000.txt missing in zip')
    return []
  }
  const text = entry.getData().toString('utf8')
  const lines = text.split('\n')
  /** @type {import('../src/types/geo').PlaceRecord[]} */
  const out = []
  const seen = new Set()
  for (const line of lines) {
    if (!line.trim()) continue
    const cols = line.split('\t')
    const name = cols[1]
    const country = cols[8]
    const pop = parseInt(cols[14], 10) || 0
    if (!name || !country || pop < 50000) continue
    const key = `${country}|${normKey(name)}`
    if (seen.has(key)) continue
    seen.add(key)
    const continents = countryContinents.get(country)
    if (!continents) continue
    const alts = (cols[3] || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    out.push({
      id: `t-${slug(`${country}-${name}-${cols[0]}`)}`,
      canonical: name,
      category: 'city',
      continents: [...continents],
      aliases: alts.length ? alts : undefined,
      countryCode: country,
    })
  }
  return out
}

function buildIslands() {
  return ISLAND_DATA.map(([name, continents]) => ({
    id: `i-${slug(name)}`,
    canonical: name,
    category: 'island',
    continents: [...continents].sort(),
    aliases: [],
  }))
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  console.log('Fetching countries…')
  const { places: countries, countryContinents } = await buildCountries()

  writeFileSync(join(OUT, 'countries.json'), JSON.stringify(countries))

  console.log('Fetching states…')
  const states = await buildStates(countryContinents)
  writeFileSync(join(OUT, 'states.json'), JSON.stringify(states))

  console.log('Fetching cities (GeoNames cities15000)…')
  let cities = []
  try {
    cities = await buildCities(countryContinents)
  } catch (e) {
    console.warn('Cities build failed:', e.message)
  }
  writeFileSync(join(OUT, 'cities.json'), JSON.stringify(cities))

  const islands = buildIslands()
  writeFileSync(join(OUT, 'islands.json'), JSON.stringify(islands))

  const meta = {
    generatedAt: new Date().toISOString(),
    counts: {
      countriesAndTerritories: countries.length,
      states: states.length,
      cities: cities.length,
      islands: islands.length,
    },
    continents: CONTINENTS,
  }
  writeFileSync(join(OUT, 'meta.json'), JSON.stringify(meta, null, 2))
  console.log('Done.', meta.counts)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
