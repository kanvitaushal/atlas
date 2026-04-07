import { useCallback, useState } from 'react'
import { AtlasView } from './components/AtlasView'
import { BugHelpModal } from './components/BugHelpModal'
import { GameView } from './components/GameView'
import { MultiplayerLobby } from './components/MultiplayerLobby'
import { MultiplayerGameView } from './components/MultiplayerGameView'
import { StartScreen } from './components/StartScreen'
import { DEFAULT_TIMER_SEC } from './constants'
import { loadDataset } from './lib/loadData'
import { PlaceIndex } from './lib/placeIndex'
import { playClick } from './lib/sounds'
import type { ContinentCode, PlaceCategory } from './types/geo'

type Phase = 'menu' | 'loading' | 'play' | 'atlas' | 'multiplayer-lobby' | 'multiplayer-game' | 'game-over'

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
  const [multiplayerSessionId, setMultiplayerSessionId] = useState<string | null>(null)
  const [finalScores, setFinalScores] = useState<Record<string, number> | null>(null)

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

  const startMultiplayerGame = useCallback(async () => {
    setLoadError(null)
    setPhase('loading')
    try {
      const records = await loadDataset(categories)
      setIndex(new PlaceIndex(records))
      setPhase('multiplayer-lobby')
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load data.')
      setPhase('menu')
    }
  }, [categories])

  const handleMultiplayerGameStart = useCallback((sessionId: string) => {
    setMultiplayerSessionId(sessionId)
    setPhase('multiplayer-game')
  }, [])

  const handleMultiplayerGameEnd = useCallback((scores: Record<string, number>) => {
    setFinalScores(scores)
    setPhase('game-over')
  }, [])

  const handleBackToMenu = useCallback(() => {
    setPhase('menu')
    setIndex(null)
    setMultiplayerSessionId(null)
    setFinalScores(null)
  }, [])

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
            onMultiplayer={startMultiplayerGame}
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
        {phase === 'multiplayer-lobby' && (
          <MultiplayerLobby
            onGameStart={handleMultiplayerGameStart}
            onBack={handleBackToMenu}
          />
        )}
        {phase === 'multiplayer-game' && multiplayerSessionId && index && (
          <MultiplayerGameView
            sessionId={multiplayerSessionId}
            index={index}
            onLeave={handleBackToMenu}
            onGameEnd={handleMultiplayerGameEnd}
          />
        )}
        {phase === 'game-over' && finalScores && (
          <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-10">
            <div className="text-center">
              <h1 className="atlas-glow text-4xl font-semibold tracking-tight text-white drop-shadow-lg md:text-5xl">
                Game Over!
              </h1>
              <div className="mt-8 space-y-4">
                {Object.entries(finalScores)
                  .sort(([, a], [, b]) => b - a)
                  .map(([userId, score], index) => (
                    <div
                      key={userId}
                      className="flex items-center justify-between rounded-lg bg-white/5 px-6 py-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 text-white font-bold">
                          {index + 1}
                        </div>
                        <span className="text-white font-medium">
                          {userId === 'current-user' ? 'You' : `Player ${index + 1}`}
                        </span>
                      </div>
                      <span className="text-cyan-300 font-semibold">{score} pts</span>
                    </div>
                  ))}
              </div>
              <button
                onClick={handleBackToMenu}
                className="mt-8 w-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-3 font-semibold text-white transition hover:from-cyan-600 hover:to-emerald-600"
              >
                Back to Menu
              </button>
            </div>
          </div>
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
