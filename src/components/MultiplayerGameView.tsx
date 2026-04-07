import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../auth/AuthContext'
import { multiplayerService, type GameSession, type GamePlayer, type GameMove } from '../lib/multiplayer'
import { lastChainLetter } from '../lib/normalize'
import { PlaceIndex, validateAnswer } from '../lib/placeIndex'
import { playClick, playInvalid, playValid } from '../lib/sounds'
import { LetterHero } from './LetterHero'
import type { ContinentCode, PlaceCategory } from '../types/geo'

interface MultiplayerGameViewProps {
  sessionId: string
  index: PlaceIndex
  onLeave: () => void
  onGameEnd: (scores: Record<string, number>) => void
}

export function MultiplayerGameView({ sessionId, index, onLeave, onGameEnd }: MultiplayerGameViewProps) {
  const { user } = useAuth()
  const [session, setSession] = useState<GameSession | null>(null)
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [moves, setMoves] = useState<GameMove[]>([])
  const [input, setInput] = useState('')
  const [currentTurn, setCurrentTurn] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const currentPlayer = players.find(p => p.user_id === user?.id)
  const isMyTurn = currentPlayer?.player_index === currentTurn
  const gameChain = session?.current_chain || []
  const lastPlace = gameChain[gameChain.length - 1]
  const requiredLetter = lastPlace ? lastChainLetter(lastPlace) : null

  useEffect(() => {
    const loadGameData = async () => {
      try {
        console.log('MultiplayerGameView: Loading game data for session', sessionId)
        
        // Load the game session first
        const gameSession = await multiplayerService.getGameSessionById(sessionId)
        if (!gameSession) {
          throw new Error('Game session not found')
        }
        
        console.log('MultiplayerGameView: Game session loaded', gameSession)
        setSession(gameSession)
        setCurrentTurn(gameSession.current_turn_index)
        
        // Load players and moves
        const [gamePlayers, gameMoves] = await Promise.all([
          multiplayerService.getGamePlayers(sessionId),
          multiplayerService.getGameMoves(sessionId)
        ])

        console.log('MultiplayerGameView: Players and moves loaded', { gamePlayers, gameMoves })
        setPlayers(gamePlayers)
        setMoves(gameMoves)
        setLoading(false)
      } catch (err) {
        console.error('MultiplayerGameView: Failed to load game data', err)
        setError(err instanceof Error ? err.message : 'Failed to load game')
        setLoading(false)
      }
    }

    loadGameData()
  }, [sessionId])

  useEffect(() => {
    if (session) {
      console.log('MultiplayerGameView: Setting up subscription for session', session.id)
      
      const channel = multiplayerService.subscribeToGameSession(session.id, {
        onSessionUpdate: (newSession) => {
          console.log('MultiplayerGameView: Session update received', newSession)
          setSession(newSession)
          setCurrentTurn(newSession.current_turn_index)
          
          if (newSession.status === 'finished') {
            onGameEnd(newSession.scores)
          }
        },
        onPlayerUpdate: (updatedPlayers) => {
          console.log('MultiplayerGameView: Player update received', updatedPlayers)
          setPlayers(updatedPlayers)
        },
        onMoveUpdate: (updatedMoves) => {
          console.log('MultiplayerGameView: Move update received', updatedMoves)
          setMoves(updatedMoves)
        }
      })

      console.log('MultiplayerGameView: Subscription active, channel status:', channel)

      return () => {
        console.log('MultiplayerGameView: Cleaning up subscription for session', session.id)
        multiplayerService.unsubscribe(session.id)
      }
    }
  }, [sessionId, onGameEnd, session])

  useEffect(() => {
    if (isMyTurn && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isMyTurn])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('=== SUBMIT BUTTON DEBUG ===')
    console.log('MultiplayerGameView: Submit button clicked', { input, isMyTurn, currentPlayer })
    console.log('MultiplayerGameView: User check', { user: !!user, userId: user?.id })
    console.log('MultiplayerGameView: Session check', { session: !!session, sessionId })
    console.log('MultiplayerGameView: Players array', players)
    console.log('MultiplayerGameView: Current turn', currentTurn)
    console.log('MultiplayerGameView: Current player object', currentPlayer)
    console.log('MultiplayerGameView: isMyTurn calculation', currentPlayer?.player_index, currentTurn, currentPlayer?.player_index === currentTurn)
    
    if (!user || !currentPlayer || !isMyTurn || !input.trim() || !session) {
      console.log('MultiplayerGameView: Submit validation FAILED', { 
        hasUser: !!user, 
        hasCurrentPlayer: !!currentPlayer, 
        isMyTurn, 
        hasInput: !!input.trim(), 
        hasSession: !!session 
      })
      return
    }

    const answer = input.trim()
    console.log('MultiplayerGameView: Processing answer', answer)
    
    // Use same logic as single-player tryCommitPlace
    const place = index.resolve(answer, new Set(session.categories as PlaceCategory[]))
    if (!place) {
      console.log('MultiplayerGameView: Place not found', answer)
      playInvalid()
      setError('Not in this atlas (or not in your selected types).')
      setTimeout(() => setError(null), 3000)
      return
    }

    console.log('MultiplayerGameView: Place found', place)

    const validation = validateAnswer(
      place,
      requiredLetter,
      new Set(session.categories as PlaceCategory[]),
      new Set(session.continents as ContinentCode[]),
      new Set(moves.map(m => m.place_data?.id).filter(Boolean))
    )
    
    console.log('MultiplayerGameView: Validation result', validation)
    
    if (!validation.ok) {
      console.log('MultiplayerGameView: Validation failed', validation.reason)
      playInvalid()
      setError(validation.reason)
      setTimeout(() => setError(null), 3000)
      return
    }

    // MULTIPLAYER ADAPTATION: Update shared state instead of local state
    try {
      console.log('MultiplayerGameView: Submitting move', { 
        sessionId, 
        userId: user.id, 
        playerIndex: currentPlayer.player_index, 
        answer, 
        place 
      })
      
      // Submit move to shared state
      await multiplayerService.makeMove(
        sessionId,
        user.id,
        currentPlayer.player_index,
        answer,
        place,
        true, // isValid
        1 // points
      )

      console.log('MultiplayerGameView: Move submitted successfully')
      
      // CRITICAL: Update turn in database for real-time sync
      const nextPlayerIndex = (currentPlayer.player_index + 1) % players.length
      console.log('MultiplayerGameView: Updating turn to player', nextPlayerIndex)
      
      await multiplayerService.updateCurrentTurn(sessionId, nextPlayerIndex)

      console.log('MultiplayerGameView: Turn updated successfully')
      
      // Single-player success feedback
      playValid()
      setInput('')
      setError(null)
    } catch (err) {
      console.error('MultiplayerGameView: Failed to submit move', err)
      setError(err instanceof Error ? err.message : 'Failed to submit move')
    }
  }, [user, currentPlayer, isMyTurn, input, sessionId, index, requiredLetter, moves, session, players])

  const handlePassTurn = useCallback(async () => {
    console.log('MultiplayerGameView: Pass turn button clicked', { isMyTurn, currentPlayer })
    
    if (!user || !currentPlayer || !isMyTurn || !session) {
      console.log('MultiplayerGameView: Pass turn validation failed', { 
        hasUser: !!user, 
        hasCurrentPlayer: !!currentPlayer, 
        isMyTurn, 
        hasSession: !!session 
      })
      return
    }

    try {
      console.log('MultiplayerGameView: Passing turn', { 
        sessionId, 
        userId: user.id, 
        playerIndex: currentPlayer.player_index 
      })
      
      // Create a pass move
      await multiplayerService.makeMove(
        sessionId,
        user.id,
        currentPlayer.player_index,
        'PASS',
        null,
        true, // isValid
        0 // 0 points for pass
      )

      // CRITICAL: Update turn in database for real-time sync
      const nextPlayerIndex = (currentPlayer.player_index + 1) % players.length
      console.log('MultiplayerGameView: Updating turn to player', nextPlayerIndex)
      
      await multiplayerService.updateCurrentTurn(sessionId, nextPlayerIndex)

      console.log('MultiplayerGameView: Turn passed successfully')
      playClick()
      setInput('')
      setError(null)
    } catch (err) {
      console.error('MultiplayerGameView: Failed to pass turn', err)
      setError(err instanceof Error ? err.message : 'Failed to pass turn')
    }
  }, [user, currentPlayer, isMyTurn, sessionId, players])

  const handleLeave = () => {
    playClick()
    onLeave()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-cyan-100/80">Loading game...</div>
      </div>
    )
  }

  if (!session || !currentPlayer) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-300">Game not found</div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-xs uppercase tracking-widest text-slate-400">
              Room: <span className="font-mono text-cyan-300">{session.room_name}</span>
              <span className="text-cyan-100/40 ml-2">({session.room_code})</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center gap-2 ${
                  player.player_index === currentTurn ? 'text-cyan-300' : 'text-cyan-100/60'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${
                  player.player_index === currentTurn ? 'bg-cyan-400' : 'bg-cyan-100/40'
                }`} />
                <span className="text-sm font-medium">
                  {player.user_id === user?.id ? 'You' : player.player_name}
                </span>
                <span className="text-xs">
                  {session.scores[player.user_id] || 0} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          <LetterHero
            letter={requiredLetter}
            expandedFromLast={false}
          />

          <div className="mt-8 text-center">
            {isMyTurn ? (
              <div className="space-y-4">
                <h2 className="text-lg font-medium text-cyan-100/90">Your turn!</h2>
                <form onSubmit={handleSubmit} className="flex gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={requiredLetter ? `Place starting with "${requiredLetter}"...` : 'Any place...'}
                    className="flex-1 rounded-lg bg-white/10 px-4 py-3 text-white placeholder-cyan-100/40 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    onClick={(e) => {
                      console.log('SUBMIT BUTTON CLICKED DIRECTLY!')
                      console.log('Current state:', { input, isMyTurn, currentPlayer })
                    }}
                    className="rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-3 font-semibold text-white transition hover:from-cyan-600 hover:to-emerald-600 disabled:opacity-50"
                  >
                    Submit
                  </button>
                  <button
                    type="button"
                    onClick={handlePassTurn}
                    className="rounded-full border border-white/20 bg-white/5 px-6 py-3 font-semibold text-cyan-100/90 transition hover:bg-white/10"
                  >
                    Pass Turn
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-2">
                <h2 className="text-lg font-medium text-cyan-100/90">
                  {players.find(p => p.player_index === currentTurn)?.user_id === user?.id 
                    ? 'Your turn!' 
                    : `${players.find(p => p.player_index === currentTurn)?.player_name || `Player ${currentTurn + 1}`}'s turn`
                  }
                </h2>
                <p className="text-sm text-cyan-100/60">Waiting for their move...</p>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}
          </div>

          <div className="mt-12">
            <h3 className="text-sm font-medium text-cyan-100/60 mb-3">Recent Moves</h3>
            <div className="space-y-2">
              {moves.slice(-5).reverse().map((move) => (
                <div
                  key={move.id}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-cyan-100/60">#{move.move_number}</span>
                    <span className="text-white font-medium">{move.move_text}</span>
                    {move.is_valid && (
                      <span className="text-xs text-green-400">+{move.points}</span>
                    )}
                  </div>
                  <span className="text-xs text-cyan-100/60">
                    {players.find(p => p.user_id === move.player_id)?.user_id === user?.id 
                      ? 'You' 
                      : `Player ${move.player_index + 1}`
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
