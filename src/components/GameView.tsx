import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import type { ContinentCode, PlaceCategory, PlaceRecord } from '../types/geo'
import {
  hasAnyLegalMove,
  pickBotPlace,
  pickNextRequiredLetter,
} from '../lib/bot'
import { burstConfetti } from '../lib/confetti'
import { lastChainLetter, normKey } from '../lib/normalize'
import { PlaceIndex, validateAnswer } from '../lib/placeIndex'
import { playClick, playInvalid, playValid, resumeAudio } from '../lib/sounds'
import { LetterHero } from './LetterHero'

interface GameViewProps {
  index: PlaceIndex
  categories: ReadonlySet<PlaceCategory>
  continents: ReadonlySet<ContinentCode>
  mode: 'solo' | 'two'
  timerEnabled: boolean
  timerLimitSec: number
  onLeave: () => void
}

function winnerHeadline(
  scores: [number, number],
  mode: 'solo' | 'two',
): string {
  const [a, b] = scores
  if (a === b) return "It's a tie!"
  if (a > b) return mode === 'solo' ? 'You win!' : 'Player 1 wins!'
  return mode === 'solo' ? 'Bot wins!' : 'Player 2 wins!'
}

export function GameView({
  index,
  categories,
  continents,
  mode,
  timerEnabled,
  timerLimitSec,
  onLeave,
}: GameViewProps) {
  const [input, setInput] = useState('')
  const [requiredStart, setRequiredStart] = useState<string | null>(null)
  const [previous, setPrevious] = useState<string | null>(null)
  const [usedIds, setUsedIds] = useState<Set<string>>(() => new Set())
  const [usedOrder, setUsedOrder] = useState<string[]>([])
  const [currentPlayer, setCurrentPlayer] = useState(0)
  const [scores, setScores] = useState<[number, number]>([0, 0])
  const [streak, setStreak] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [glow, setGlow] = useState(false)
  const [timeLeft, setTimeLeft] = useState(timerLimitSec)
  const [botThinking, setBotThinking] = useState(false)
  const [gameOver, setGameOver] = useState<{ reason: string } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef(input)
  inputRef.current = input
  const placeInputRef = useRef<HTMLInputElement>(null)

  const continentSet = useMemo(
    () => (continents.size > 0 ? continents : null),
    [continents],
  )

  const runShake = useCallback(() => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }, [])

  const resetTimer = useCallback(() => {
    if (timerEnabled) setTimeLeft(timerLimitSec)
  }, [timerEnabled, timerLimitSec])

  useEffect(() => {
    if (timerEnabled) setTimeLeft(timerLimitSec)
  }, [timerEnabled, timerLimitSec])

  const updateHint = useCallback(
    (raw: string) => {
      if (gameOver) return
      const t = raw.trim()
      if (!t) {
        setHint(null)
        return
      }
      const place = index.resolve(t, categories)
      if (!place) {
        setHint('Not in this atlas (or not in your selected types).')
        return
      }
      const v = validateAnswer(
        place,
        requiredStart,
        categories,
        continentSet,
        usedIds,
      )
      if (!v.ok) setHint(v.reason)
      else {
        const expanded =
          normKey(t) !== normKey(place.canonical)
            ? ` (counts as ${place.canonical})`
            : ''
        setHint(`Eligible — submitting automatically…${expanded}`)
      }
    },
    [index, categories, continentSet, requiredStart, usedIds, gameOver],
  )

  useEffect(() => {
    const t = setTimeout(() => updateHint(input), 120)
    return () => clearTimeout(t)
  }, [input, updateHint])

  const humanTurn =
    mode === 'two' || (mode === 'solo' && currentPlayer === 0)

  /** Keep the text field focused whenever it's the human's turn (e.g. after the bot plays). */
  useEffect(() => {
    if (gameOver) return
    if (!humanTurn || botThinking) return
    const t = window.setTimeout(() => {
      const el = placeInputRef.current
      if (!el || el.disabled) return
      el.focus({ preventScroll: true })
    }, 0)
    return () => clearTimeout(t)
  }, [humanTurn, botThinking, gameOver, currentPlayer, mode])

  const applySuccess = useCallback(
    (
      place: PlaceRecord,
      args: { scorer: 0 | 1; nextPlayer: 0 | 1; fromHumanInput: boolean },
    ) => {
      const { scorer, nextPlayer, fromHumanInput } = args
      playValid()
      setGlow(true)
      setTimeout(() => setGlow(false), 900)

      setStreak((s) => {
        const nextStreak = s + 1
        if (nextStreak > 0 && nextStreak % 3 === 0 && rootRef.current) {
          const r = rootRef.current.getBoundingClientRect()
          burstConfetti(r.left + r.width / 2, r.top + 120, document.body)
        }
        return nextStreak
      })

      const usedAfter = new Set(usedIds)
      usedAfter.add(place.id)
      const nextReq = pickNextRequiredLetter(
        place.canonical,
        index.records,
        categories,
        continentSet,
        usedAfter,
      )

      const nextCanMove = hasAnyLegalMove(
        nextReq,
        index.records,
        categories,
        continentSet,
        usedAfter,
      )
      if (!nextCanMove) {
        setGameOver({ reason: 'No legal moves remain for the next player.' })
      }

      setUsedIds(usedAfter)
      setUsedOrder((o) => [...o, place.canonical])
      setPrevious(place.canonical)
      setRequiredStart(nextReq)
      if (fromHumanInput) setInput('')
      setHint(null)

      setScores(([a, b]) =>
        scorer === 0 ? [a + 1, b] : [a, b + 1],
      )
      setCurrentPlayer(nextPlayer)
      resetTimer()
    },
    [
      resetTimer,
      usedIds,
      index.records,
      categories,
      continentSet,
    ],
  )

  const tryCommitPlace = useCallback(
    (raw: string, fromHumanInput: boolean): boolean => {
      if (gameOver) return false
      resumeAudio()
      const trimmed = raw.trim()
      if (!trimmed) return false

      const place = index.resolve(trimmed, categories)
      if (!place) {
        playInvalid()
        runShake()
        setHint('Not in this atlas (or not in your selected types).')
        setStreak(0)
        return false
      }

      const v = validateAnswer(
        place,
        requiredStart,
        categories,
        continentSet,
        usedIds,
      )
      if (!v.ok) {
        playInvalid()
        runShake()
        setHint(v.reason)
        setStreak(0)
        return false
      }

      const scorer = currentPlayer as 0 | 1
      const nextPlayer: 0 | 1 = currentPlayer === 0 ? 1 : 0

      applySuccess(place, { scorer, nextPlayer, fromHumanInput })
      return true
    },
    [
      index,
      categories,
      continentSet,
      requiredStart,
      usedIds,
      currentPlayer,
      applySuccess,
      runShake,
      gameOver,
    ],
  )

  useEffect(() => {
    if (gameOver) return
    if (!humanTurn || !input.trim()) return
    const snapshot = input.trim()
    const place = index.resolve(snapshot, categories)
    if (!place) return
    const v = validateAnswer(
      place,
      requiredStart,
      categories,
      continentSet,
      usedIds,
    )
    if (!v.ok) return

    const t = setTimeout(() => {
      const latest = inputRef.current.trim()
      if (latest !== snapshot) return
      const p2 = index.resolve(latest, categories)
      if (!p2 || p2.id !== place.id) return
      const v2 = validateAnswer(
        p2,
        requiredStart,
        categories,
        continentSet,
        usedIds,
      )
      if (!v2.ok) return
      if (!(mode === 'two' || (mode === 'solo' && currentPlayer === 0))) return
      tryCommitPlace(latest, true)
    }, 450)
    return () => clearTimeout(t)
  }, [
    input,
    humanTurn,
    index,
    categories,
    continentSet,
    requiredStart,
    usedIds,
    mode,
    currentPlayer,
    tryCommitPlace,
    gameOver,
  ])

  useEffect(() => {
    if (gameOver) return
    const isHuman =
      mode === 'two' || (mode === 'solo' && currentPlayer === 0)
    if (!isHuman) return
    if (
      !hasAnyLegalMove(
        requiredStart,
        index.records,
        categories,
        continentSet,
        usedIds,
      )
    ) {
      setGameOver({ reason: 'No legal moves remain for the current player.' })
    }
  }, [
    gameOver,
    mode,
    currentPlayer,
    requiredStart,
    usedIds,
    index.records,
    categories,
    continentSet,
  ])

  useEffect(() => {
    if (gameOver) return
    if (mode !== 'solo' || currentPlayer !== 1) {
      setBotThinking(false)
      return
    }
    setBotThinking(true)
    const delay = 700 + Math.random() * 900
    const id = window.setTimeout(() => {
      const botPlace = pickBotPlace(
        index.records,
        requiredStart,
        categories,
        continentSet,
        usedIds,
      )
      if (!botPlace) {
        playInvalid()
        setGameOver({ reason: 'The bot has no valid move.' })
        setBotThinking(false)
        return
      }
      const v = validateAnswer(
        botPlace,
        requiredStart,
        categories,
        continentSet,
        usedIds,
      )
      if (!v.ok) {
        setGameOver({ reason: 'The bot could not play a valid move.' })
        setBotThinking(false)
        return
      }
      applySuccess(botPlace, { scorer: 1, nextPlayer: 0, fromHumanInput: false })
      setBotThinking(false)
    }, delay)
    return () => {
      clearTimeout(id)
      setBotThinking(false)
    }
  }, [
    mode,
    currentPlayer,
    index.records,
    requiredStart,
    categories,
    continentSet,
    usedIds,
    applySuccess,
    resetTimer,
    gameOver,
  ])

  useEffect(() => {
    if (gameOver) return
    if (!timerEnabled) return
    const humanTiming = mode === 'two' || (mode === 'solo' && currentPlayer === 0)
    if (!humanTiming) return

    const iv = window.setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          playInvalid()
          if (mode === 'two') {
            setCurrentPlayer((p) => (p === 0 ? 1 : 0))
          } else {
            setCurrentPlayer(1)
          }
          return timerLimitSec
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [timerEnabled, mode, currentPlayer, timerLimitSec, gameOver])

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (gameOver) return
    if (!humanTurn || botThinking) return
    playClick()
    tryCommitPlace(input, true)
  }

  const restart = () => {
    playClick()
    setGameOver(null)
    setInput('')
    setRequiredStart(null)
    setPrevious(null)
    setUsedIds(new Set())
    setUsedOrder([])
    setCurrentPlayer(0)
    setScores([0, 0])
    setStreak(0)
    setHint(null)
    setBotThinking(false)
    resetTimer()
  }

  const passTurn = useCallback(() => {
    if (gameOver) return
    if (!humanTurn || botThinking) return
    playClick()
    setInput('')
    setHint(null)
    setStreak(0)
    if (mode === 'two') {
      setCurrentPlayer((p) => (p === 0 ? 1 : 0))
    } else {
      setCurrentPlayer(1)
    }
    resetTimer()
  }, [gameOver, humanTurn, botThinking, mode, resetTimer])

  const turnLabel = gameOver
    ? 'Game over'
    : mode === 'solo'
      ? currentPlayer === 0
        ? botThinking
          ? 'Atlas is thinking…'
          : 'Your turn'
        : 'Atlas is thinking…'
      : `Player ${currentPlayer + 1}'s turn`

  return (
    <div ref={rootRef} className="relative mx-auto flex max-w-xl flex-col gap-6 px-4 py-8 pb-24">
      {gameOver && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md">
          <div
            className="glass w-full max-w-md rounded-3xl border border-white/15 p-8 text-center shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-over-title"
          >
            <h2
              id="game-over-title"
              className="text-2xl font-semibold tracking-tight text-white"
            >
              Game over
            </h2>
            <p className="mt-3 text-lg text-emerald-200/95">
              {winnerHeadline(scores, mode)}
            </p>
            <p className="mt-1 font-mono text-sm text-slate-400">
              {mode === 'solo'
                ? `You ${scores[0]} — Bot ${scores[1]}`
                : `Player 1: ${scores[0]} — Player 2: ${scores[1]}`}
            </p>
            <p className="mt-4 text-sm text-slate-400">{gameOver.reason}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={restart}
                className="rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/25"
              >
                Play again
              </button>
              <button
                type="button"
                onClick={() => {
                  playClick()
                  onLeave()
                }}
                className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-slate-200"
              >
                Menu
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Atlas</h1>
          <p className="text-sm text-cyan-100/70">{turnLabel}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={restart}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Restart round
          </button>
          <button
            type="button"
            onClick={() => {
              playClick()
              onLeave()
            }}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Menu
          </button>
        </div>
      </header>

      {mode === 'two' && (
        <div className="flex gap-3">
          <div
            className={`glass flex-1 rounded-2xl px-4 py-3 text-center ${
              currentPlayer === 0 ? 'ring-2 ring-cyan-400/50' : ''
            }`}
          >
            <div className="text-xs text-slate-400">Player 1</div>
            <div className="text-2xl font-semibold text-white">{scores[0]}</div>
          </div>
          <div
            className={`glass flex-1 rounded-2xl px-4 py-3 text-center ${
              currentPlayer === 1 ? 'ring-2 ring-emerald-400/50' : ''
            }`}
          >
            <div className="text-xs text-slate-400">Player 2</div>
            <div className="text-2xl font-semibold text-white">{scores[1]}</div>
          </div>
        </div>
      )}

      {mode === 'solo' && (
        <div className="flex gap-3">
          <div
            className={`glass flex-1 rounded-2xl px-4 py-3 text-center ${
              currentPlayer === 0 && !botThinking ? 'ring-2 ring-cyan-400/50' : ''
            }`}
          >
            <div className="text-xs text-slate-400">You</div>
            <div className="text-2xl font-semibold text-white">{scores[0]}</div>
          </div>
          <div
            className={`glass flex-1 rounded-2xl px-4 py-3 text-center ${
              currentPlayer === 1 || botThinking ? 'ring-2 ring-emerald-400/50' : ''
            }`}
          >
            <div className="text-xs text-slate-400">Bot</div>
            <div className="text-2xl font-semibold text-white">{scores[1]}</div>
          </div>
        </div>
      )}

      {timerEnabled && humanTurn && !gameOver && (
        <div className="text-center text-sm text-cyan-200/80">
          Time left: <span className="font-mono font-semibold">{timeLeft}s</span>
        </div>
      )}

      <div className="flex justify-center py-2">
        <LetterHero
          letter={requiredStart}
          expandedFromLast={
            Boolean(
              previous &&
                requiredStart &&
                lastChainLetter(previous) !== requiredStart,
            )
          }
        />
      </div>

      <div
        className={`glass rounded-3xl p-5 transition ${
          glow ? 'answer-glow ring-2 ring-emerald-400/40' : ''
        }`}
      >
        <p className="text-xs uppercase tracking-widest text-slate-400">Previous</p>
        <p className="mt-1 min-h-[1.75rem] text-xl text-white">
          {previous ?? '—'}
        </p>
      </div>

      <form
        onSubmit={onFormSubmit}
        className={`glass rounded-3xl p-5 ${shake ? 'shake' : ''}`}
      >
        <label htmlFor="place" className="text-xs uppercase tracking-widest text-slate-400">
          {mode === 'solo' ? 'Your place' : `Player ${currentPlayer + 1}`}
        </label>
        <input
          ref={placeInputRef}
          id="place"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={gameOver || !humanTurn || botThinking}
          autoComplete="off"
          autoCapitalize="words"
          placeholder={
            humanTurn && !botThinking ? 'Type a place…' : 'Wait for the bot…'
          }
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-lg text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:opacity-50"
        />
        {hint && humanTurn && (
          <p className="mt-3 text-sm text-amber-200/80 transition-opacity">{hint}</p>
        )}
        <p className="mt-3 text-center text-xs text-slate-500">
          Valid answers submit automatically after a short pause. Press Enter anytime to submit
          immediately.
        </p>
        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            type="button"
            disabled={gameOver || !humanTurn || botThinking}
            onClick={passTurn}
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[10rem]"
          >
            Pass turn
          </button>
          <p className="max-w-sm text-center text-[11px] leading-snug text-slate-500">
            Give the turn to {mode === 'solo' ? 'the bot' : 'the other player'}. No points; the
            required letter stays the same.
          </p>
        </div>
      </form>

      <section className="glass max-h-48 overflow-y-auto rounded-3xl p-5">
        <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-200/60">
          Used ({usedOrder.length})
        </h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {usedOrder.map((name, i) => (
            <li
              key={`${i}-${name}`}
              className="rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300"
            >
              {name}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
