import { useCallback, useState } from 'react'
import { AtlasView } from './components/AtlasView'
import { BugHelpModal } from './components/BugHelpModal'
import { GameView } from './components/GameView'
import { StartScreen } from './components/StartScreen'
import { DEFAULT_TIMER_SEC } from './constants'
import { loadDataset } from './lib/loadData'
import { PlaceIndex } from './lib/placeIndex'
import { playClick } from './lib/sounds'
import type { ContinentCode, PlaceCategory } from './types/geo'

type Phase = 'menu' | 'loading' | 'play' | 'atlas'

const defaultCategories = new Set<PlaceCategory>([
  'country',
  'city',
  'state',
  'territory',
  'island',
])

export default function App() {
  const [phase, setPhase] = useState<Phase>('menu')
  const [categories, setCategories] = useState<Set<PlaceCategory>>(
    () => new Set(defaultCategories),
  )
  const [continents, setContinents] = useState<Set<ContinentCode>>(() => new Set())
  const [mode, setMode] = useState<'solo' | 'two'>('two')
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerLimitSec, setTimerLimitSec] = useState(DEFAULT_TIMER_SEC)
  const [index, setIndex] = useState<PlaceIndex | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [bugHelpOpen, setBugHelpOpen] = useState(false)

  const toggleCategory = useCallback((c: PlaceCategory) => {
    setCategories((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }, [])

  const toggleContinent = useCallback((c: ContinentCode) => {
    setContinents((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }, [])

  const startGame = useCallback(async () => {
    setLoadError(null)
    setPhase('loading')
    try {
      const records = await loadDataset(categories)
      setIndex(new PlaceIndex(records))
      setPhase('play')
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load data.')
      setPhase('menu')
    }
  }, [categories])

  return (
    <div className="atlas-root flex min-h-screen flex-col font-sans">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-cyan-500/20 blur-[100px]" />
        <div className="absolute -right-20 bottom-32 h-80 w-80 rounded-full bg-emerald-500/20 blur-[90px]" />
        <div className="absolute left-1/2 top-1/2 h-[min(80vw,28rem)] w-[min(80vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500/10 blur-[120px]" />
      </div>

      <main className="relative z-10 flex flex-1 flex-col">
        {phase === 'menu' && (
          <StartScreen
            categories={categories}
            continents={continents}
            mode={mode}
            timerEnabled={timerEnabled}
            timerLimitSec={timerLimitSec}
            loading={false}
            onToggleCategory={toggleCategory}
            onToggleContinent={toggleContinent}
            onMode={setMode}
            onTimerToggle={() => setTimerEnabled((t) => !t)}
            onTimerLimit={setTimerLimitSec}
            onStart={startGame}
            onOpenAtlas={() => setPhase('atlas')}
          />
        )}
        {phase === 'loading' && (
          <StartScreen
            categories={categories}
            continents={continents}
            mode={mode}
            timerEnabled={timerEnabled}
            timerLimitSec={timerLimitSec}
            loading
            onToggleCategory={toggleCategory}
            onToggleContinent={toggleContinent}
            onMode={setMode}
            onTimerToggle={() => setTimerEnabled((t) => !t)}
            onTimerLimit={setTimerLimitSec}
            onStart={startGame}
            onOpenAtlas={() => setPhase('atlas')}
          />
        )}
        {phase === 'play' && index && (
          <GameView
            index={index}
            categories={categories}
            continents={continents}
            mode={mode}
            timerEnabled={timerEnabled}
            timerLimitSec={timerLimitSec}
            onLeave={() => {
              setPhase('menu')
              setIndex(null)
            }}
          />
        )}
        {phase === 'atlas' && (
          <AtlasView onBack={() => setPhase('menu')} />
        )}
        {loadError && (
          <p className="mx-auto max-w-lg px-4 pb-6 text-center text-sm text-red-300/90">
            {loadError}
          </p>
        )}
      </main>

      <footer className="relative z-10 mt-auto flex flex-col items-center gap-3 pb-6 pt-8 text-sm text-cyan-100/50">
        <button
          type="button"
          onClick={() => {
            playClick()
            setBugHelpOpen(true)
          }}
          className="max-w-xs rounded-full border border-white/15 bg-white/5 px-4 py-3 text-center text-xs font-medium leading-snug text-cyan-200/90 transition hover:bg-white/10 hover:text-cyan-100"
        >
          <span className="block">Found a glitch in the matrix?</span>
          <span className="mt-0.5 block text-[11px] text-cyan-100/80">Report your issue</span>
        </button>
        <span>Made by Tanvi Kaushal</span>
      </footer>

      <BugHelpModal open={bugHelpOpen} onClose={() => setBugHelpOpen(false)} />
    </div>
  )
}
