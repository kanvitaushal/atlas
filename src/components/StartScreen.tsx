import type { ContinentCode, PlaceCategory } from '../types/geo'
import {
  CATEGORY_OPTIONS,
  CONTINENT_OPTIONS,
  TIMER_LIMIT_OPTIONS,
} from '../constants'

interface StartScreenProps {
  categories: ReadonlySet<PlaceCategory>
  continents: ReadonlySet<ContinentCode>
  mode: 'solo' | 'two'
  timerEnabled: boolean
  timerLimitSec: number
  loading: boolean
  onToggleCategory: (c: PlaceCategory) => void
  onToggleContinent: (c: ContinentCode) => void
  onMode: (m: 'solo' | 'two') => void
  onTimerToggle: () => void
  onTimerLimit: (sec: number) => void
  onStart: () => void
  onOpenAtlas: () => void
}

export function StartScreen({
  categories,
  continents,
  mode,
  timerEnabled,
  timerLimitSec,
  loading,
  onToggleCategory,
  onToggleContinent,
  onMode,
  onTimerToggle,
  onTimerLimit,
  onStart,
  onOpenAtlas,
}: StartScreenProps) {
  const canStart = categories.size > 0 && !loading

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-8 px-4 py-10">
      <header className="text-center">
        <h1 className="atlas-glow text-4xl font-semibold tracking-tight text-white drop-shadow-lg md:text-5xl">
          Atlas
        </h1>
        <p className="mt-2 text-sm text-cyan-100/80">
          Geography word chain — match the last letter, stay inside your map.
        </p>
      </header>

      <section className="glass rounded-3xl p-6 shadow-xl">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-cyan-200/70">
          Place types
        </h2>
        <div className="flex flex-col gap-3">
          {CATEGORY_OPTIONS.map(({ id, label }) => (
            <label
              key={id}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/10"
            >
              <input
                type="checkbox"
                checked={categories.has(id)}
                onChange={() => onToggleCategory(id)}
                className="h-4 w-4 rounded border-cyan-400/50 bg-slate-900/50 text-emerald-400 focus:ring-cyan-400"
              />
              <span className="text-slate-100">{label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="glass rounded-3xl p-6 shadow-xl">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-cyan-200/70">
          Continents
        </h2>
        <p className="mb-4 text-xs text-slate-400">
          Leave all unchecked to allow the whole world. Places that span more than one continent
          match if any of those continents is selected.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CONTINENT_OPTIONS.map(({ id, label }) => (
            <label
              key={id}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm transition hover:bg-white/10"
            >
              <input
                type="checkbox"
                checked={continents.has(id)}
                onChange={() => onToggleContinent(id)}
                className="h-3.5 w-3.5 rounded border-cyan-400/50 bg-slate-900/50 text-emerald-400"
              />
              <span className="text-slate-200">{label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="glass rounded-3xl p-6 shadow-xl">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-cyan-200/70">
          Players
        </h2>
        <div className="flex gap-3">
          {(
            [
              ['solo', 'You vs bot'],
              ['two', 'Two players'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onMode(id)}
              className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                mode === id
                  ? 'border-cyan-400/60 bg-cyan-500/20 text-white shadow-[0_0_24px_rgba(34,211,238,0.25)]'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={timerEnabled}
              onChange={onTimerToggle}
              className="h-4 w-4 rounded border-cyan-400/50 bg-slate-900/50 text-emerald-400"
            />
            <span className="text-sm text-slate-200">Turn timer</span>
          </label>
          <div className="flex flex-wrap items-center gap-2 pl-7">
            <label htmlFor="timer-limit" className="text-xs text-slate-400">
              Seconds per turn
            </label>
            <select
              id="timer-limit"
              disabled={!timerEnabled}
              value={timerLimitSec}
              onChange={(e) => onTimerLimit(Number(e.target.value))}
              className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {TIMER_LIMIT_OPTIONS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}s
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <button
        type="button"
        disabled={!canStart}
        onClick={onStart}
        className="rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-4 text-center text-lg font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Loading map data…' : 'Start game'}
      </button>

      <button
        type="button"
        onClick={onOpenAtlas}
        className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-6 py-3 text-center text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20"
      >
        Open reference atlas (full dataset)
      </button>
    </div>
  )
}
