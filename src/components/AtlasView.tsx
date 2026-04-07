import { useEffect, useMemo, useState } from 'react'
import { CATEGORY_OPTIONS, CONTINENT_OPTIONS } from '../constants'
import { displayExtraAliasesForCanonical } from '../lib/extraAliases'
import { loadFullAtlas } from '../lib/loadData'
import { normKey } from '../lib/normalize'
import { playClick } from '../lib/sounds'
import type { PlaceCategory, PlaceRecord } from '../types/geo'

const MAX_RENDER = 400

const continentLabel = (c: string) =>
  CONTINENT_OPTIONS.find((x) => x.id === c)?.label ?? c

type AtlasSortKey = 'canonical' | 'category' | 'continents' | 'countryCode' | 'id'

function compareAtlasRows(
  a: PlaceRecord,
  b: PlaceRecord,
  key: AtlasSortKey,
  dir: 'asc' | 'desc',
): number {
  const m = dir === 'asc' ? 1 : -1
  let cmp = 0
  switch (key) {
    case 'canonical':
      cmp = a.canonical.localeCompare(b.canonical, undefined, { sensitivity: 'base' })
      break
    case 'category':
      cmp = a.category.localeCompare(b.category)
      break
    case 'continents': {
      const as = [...a.continents].sort().join(',')
      const bs = [...b.continents].sort().join(',')
      cmp = as.localeCompare(bs)
      break
    }
    case 'countryCode': {
      const ac = a.countryCode ?? ''
      const bc = b.countryCode ?? ''
      cmp = ac.localeCompare(bc)
      break
    }
    case 'id':
      cmp = a.id.localeCompare(b.id)
      break
    default:
      break
  }
  if (cmp !== 0) return m * cmp
  return a.canonical.localeCompare(b.canonical, undefined, { sensitivity: 'base' })
}

interface AtlasViewProps {
  onBack: () => void
}

export function AtlasView({ onBack }: AtlasViewProps) {
  const [rows, setRows] = useState<PlaceRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<PlaceCategory | 'all'>('all')
  const [sortKey, setSortKey] = useState<AtlasSortKey>('canonical')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await loadFullAtlas()
        if (!cancelled) setRows(data)
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load atlas data.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!rows) return []
    const q = normKey(query)
    return rows.filter((p) => {
      if (cat !== 'all' && p.category !== cat) return false
      if (!q) return true
      if (normKey(p.canonical).includes(q)) return true
      if (p.countryCode?.toLowerCase().includes(q)) return true
      if (p.id.toLowerCase().includes(q)) return true
      for (const a of p.aliases ?? []) {
        if (normKey(a).includes(q)) return true
      }
      for (const a of displayExtraAliasesForCanonical(p.canonical)) {
        if (normKey(a).includes(q)) return true
      }
      return false
    })
  }, [rows, query, cat])

  const sortedFiltered = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => compareAtlasRows(a, b, sortKey, sortDir))
    return arr
  }, [filtered, sortKey, sortDir])

  const shown = sortedFiltered.slice(0, MAX_RENDER)
  const truncated = filtered.length > MAX_RENDER

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Reference atlas</h1>
          <p className="text-sm text-cyan-100/70">
            Search every place in the game dataset — canonical names, aliases, continents, and
            codes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            playClick()
            onBack()
          }}
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
        >
          ← Back
        </button>
      </header>

      {!rows && !error && (
        <p className="text-center text-slate-400">Loading full dataset…</p>
      )}
      {error && <p className="text-center text-red-300/90">{error}</p>}

      {rows && (
        <>
          <div className="glass flex flex-col gap-3 rounded-3xl p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, alias, country code, id…"
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              />
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value as PlaceCategory | 'all')}
                className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-slate-200 focus:border-cyan-400/50 focus:outline-none sm:min-w-[10rem]"
              >
                <option value="all">All types</option>
                {CATEGORY_OPTIONS.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
              <span className="text-xs uppercase tracking-wider text-slate-500">Sort</span>
              <select
                value={sortKey}
                onChange={(e) => {
                  playClick()
                  setSortKey(e.target.value as AtlasSortKey)
                }}
                className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none"
              >
                <option value="canonical">Name</option>
                <option value="category">Type</option>
                <option value="continents">Continents</option>
                <option value="countryCode">Country code</option>
                <option value="id">ID</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  playClick()
                  setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                }}
                className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20"
                title="Toggle ascending / descending"
              >
                {sortDir === 'asc' ? 'A → Z' : 'Z → A'}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-slate-500">
            {filtered.length.toLocaleString()} match{filtered.length === 1 ? '' : 'es'}
            {truncated
              ? ` — showing first ${MAX_RENDER}; refine your search for more.`
              : ''}
          </p>

          <div className="glass max-h-[min(70vh,36rem)] overflow-auto rounded-3xl">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-slate-900/95 backdrop-blur-sm">
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-cyan-200/70">
                  <th className="p-3 font-medium">Canonical</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium">Continents</th>
                  <th className="hidden p-3 font-medium md:table-cell">Aliases</th>
                  <th className="hidden p-3 font-medium lg:table-cell">ID / code</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const mergedAliases = [
                    ...(p.aliases ?? []),
                    ...displayExtraAliasesForCanonical(p.canonical),
                  ]
                  const uniq = [...new Set(mergedAliases)]
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-white/5 align-top text-slate-200 hover:bg-white/[0.03]"
                    >
                      <td className="p-3 font-medium text-white">{p.canonical}</td>
                      <td className="p-3 capitalize text-slate-400">{p.category}</td>
                      <td className="p-3 text-xs text-slate-400">
                        {p.continents.map(continentLabel).join(', ')}
                      </td>
                      <td className="hidden max-w-[14rem] p-3 text-xs text-slate-400 md:table-cell">
                        {uniq.length ? uniq.join(' · ') : '—'}
                      </td>
                      <td className="hidden p-3 font-mono text-xs text-slate-500 lg:table-cell">
                        {p.id}
                        {p.countryCode ? ` · ${p.countryCode}` : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
