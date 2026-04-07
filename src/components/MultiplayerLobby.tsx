import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { LoginModal } from './LoginModal'
import { multiplayerService, type GameSession, type GamePlayer } from '../lib/multiplayer'
import { playClick } from '../lib/sounds'

interface MultiplayerLobbyProps {
  onGameStart: (sessionId: string) => void
  onBack: () => void
}

export function MultiplayerLobby({ onGameStart, onBack }: MultiplayerLobbyProps) {
  const { user } = useAuth()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [roomCode, setRoomCode] = useState('')
  const [roomName, setRoomName] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(['country'])) // Default to country
  const [turnTimeLimit, setTurnTimeLimit] = useState<number>(30) // Default 30 seconds
  const [session, setSession] = useState<GameSession | null>(null)
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loginModalOpen, setLoginModalOpen] = useState(false)

  useEffect(() => {
    if (session) {
      console.log('MultiplayerLobby: Setting up subscription for session', session.id)
      multiplayerService.subscribeToGameSession(session.id, {
        onSessionUpdate: (updatedSession) => {
          console.log('MultiplayerLobby: Session updated', updatedSession)
          setSession(updatedSession)
          
          // If game starts, navigate to game view
          if (updatedSession.status === 'playing' && session.status === 'waiting') {
            console.log('MultiplayerLobby: Game started, navigating to game')
            onGameStart(updatedSession.id)
          }
        },
        onPlayerUpdate: (updatedPlayers) => {
          console.log('MultiplayerLobby: Players updated', updatedPlayers)
          setPlayers(updatedPlayers)
        },
      })

      // Load initial players
      multiplayerService.getGamePlayers(session.id).then(players => {
        console.log('MultiplayerLobby: Initial players loaded', players)
        setPlayers(players)
      })

      // Fallback polling for player updates
      const pollInterval = setInterval(async () => {
        try {
          const updatedSession = await multiplayerService.getGameSessionById(session.id)
          if (updatedSession && updatedSession.status === 'playing' && session.status === 'waiting') {
            console.log('MultiplayerLobby: Game started via polling, navigating to game')
            onGameStart(updatedSession.id)
            return
          }
          
          const updatedPlayers = await multiplayerService.getGamePlayers(session.id)
          console.log('MultiplayerLobby: Polling players', updatedPlayers)
          setPlayers(prevPlayers => {
            // Only update if players actually changed
            if (JSON.stringify(prevPlayers) !== JSON.stringify(updatedPlayers)) {
              console.log('MultiplayerLobby: Players changed via polling', updatedPlayers)
              return updatedPlayers
            }
            return prevPlayers
          })
        } catch (err) {
          console.error('MultiplayerLobby: Error polling players', err)
        }
      }, 2000) // Poll every 2 seconds

      return () => {
        console.log('MultiplayerLobby: Unsubscribing from session', session.id)
        multiplayerService.unsubscribe(session.id)
        clearInterval(pollInterval)
      }
    }
  }, [session?.id, session?.status, onGameStart])

  const createGame = async () => {
    if (!user || !roomName.trim() || !playerName.trim()) {
      setError('Please enter both room name and your name')
      return
    }
    
    if (selectedCategories.size === 0) {
      setError('Please select at least one category')
      return
    }
    
    console.log('MultiplayerLobby: Creating game', { roomName, playerName, categories: Array.from(selectedCategories), turnTimeLimit })
    setLoading(true)
    setError(null)
    
    try {
      const { session: newSession } = await multiplayerService.createGameSession(
        user.id, 
        playerName.trim(), 
        roomName.trim(),
        {
          game_mode: 'multiplayer',
          categories: Array.from(selectedCategories),
          continents: [],
          timer_enabled: turnTimeLimit > 0,
          timer_limit_sec: turnTimeLimit
        }
      )
      
      console.log('MultiplayerLobby: Game created successfully', newSession)
      setSession(newSession)
      setMode('join') // Switch to join mode to show room code
    } catch (err) {
      console.error('MultiplayerLobby: Failed to create game', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create game'
      
      // Check for specific database errors
      if (errorMessage.includes('column') && errorMessage.includes('does not exist')) {
        setError('Database schema not updated. Please run the SQL commands in Supabase first.')
      } else if (errorMessage.includes('duplicate key')) {
        setError('Room code already exists. Please try again.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const joinGame = async () => {
    if (!user || !roomCode.trim() || !playerName.trim()) {
      setError('Please enter room code and your name')
      return
    }
    
    console.log('MultiplayerLobby: Joining game', { roomCode: roomCode.trim().toUpperCase(), playerName })
    setLoading(true)
    setError(null)
    
    try {
      const gameSession = await multiplayerService.joinGameSession(
        roomCode.trim().toUpperCase(), 
        user.id, 
        playerName.trim()
      )
      console.log('MultiplayerLobby: Successfully joined session:', gameSession)
      setSession(gameSession)
      
      // Load players
      const gamePlayers = await multiplayerService.getGamePlayers(gameSession.id)
      console.log('MultiplayerLobby: Loaded players after joining:', gamePlayers)
      setPlayers(gamePlayers)
    } catch (err) {
      console.error('MultiplayerLobby: Failed to join game:', err)
      setError(err instanceof Error ? err.message : 'Failed to join game')
    } finally {
      setLoading(false)
    }
  }

  const startGame = async () => {
    if (!session) return
    
    try {
      await multiplayerService.startGame(session.id)
      onGameStart(session.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game')
    }
  }

  const currentUserPlayer = players.find(p => p.user_id === user?.id)
  const canStart = session?.status === 'waiting' && players.length >= 2 && currentUserPlayer?.player_index === 0

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="atlas-glow text-4xl font-semibold tracking-tight text-white drop-shadow-lg md:text-5xl">
          Multiplayer
        </h1>
        <p className="mt-2 text-sm text-cyan-100/80">
          Challenge friends to a geography battle
        </p>
      </header>

      {!session ? (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 rounded-lg bg-white/5 p-1">
            <button
              onClick={() => { playClick(); setMode('create') }}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                mode === 'create'
                  ? 'bg-white/20 text-white'
                  : 'text-cyan-100/70 hover:text-white'
              }`}
            >
              Create Game
            </button>
            <button
              onClick={() => { playClick(); setMode('join') }}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                mode === 'join'
                  ? 'bg-white/20 text-white'
                  : 'text-cyan-100/70 hover:text-white'
              }`}
            >
              Join Game
            </button>
          </div>

          {mode === 'create' ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Create Game Room</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-cyan-100/80 mb-2">
                      Room Name
                    </label>
                    <input
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="Enter room name"
                      className="w-full rounded-lg bg-white/10 px-4 py-3 text-white placeholder-cyan-100/40 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      maxLength={30}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-cyan-100/80 mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full rounded-lg bg-white/10 px-4 py-3 text-white placeholder-cyan-100/40 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      maxLength={20}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-cyan-100/80 mb-2">
                      Categories
                    </label>
                    <div className="space-y-2">
                      {['country', 'city', 'state', 'territory', 'island'].map((category) => (
                        <label key={category} className="flex items-center gap-2 text-cyan-100/80">
                          <input
                            type="checkbox"
                            checked={selectedCategories.has(category)}
                            onChange={(e) => {
                              const newCategories = new Set(selectedCategories)
                              if (e.target.checked) {
                                newCategories.add(category)
                              } else {
                                newCategories.delete(category)
                              }
                              setSelectedCategories(newCategories)
                            }}
                            className="rounded border-white/20 bg-white/10 text-cyan-400 focus:ring-cyan-400"
                          />
                          <span className="capitalize">{category}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-cyan-100/80 mb-2">
                      Turn Time Limit
                    </label>
                    <select
                      value={turnTimeLimit}
                      onChange={(e) => setTurnTimeLimit(Number(e.target.value))}
                      className="w-full rounded-lg bg-white/10 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    >
                      <option value={0}>No time limit</option>
                      <option value={10}>10 seconds</option>
                      <option value={20}>20 seconds</option>
                      <option value={30}>30 seconds</option>
                      <option value={60}>60 seconds</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={createGame}
                  disabled={loading || !user || !roomName.trim() || !playerName.trim() || selectedCategories.size === 0}
                  className="mt-6 w-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-3 font-semibold text-white transition hover:from-cyan-600 hover:to-emerald-600 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Game Room'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Join Game Room</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-cyan-100/80 mb-2">
                      Room Code
                    </label>
                    <input
                      type="text"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      placeholder="Enter 6-character code"
                      className="w-full rounded-lg bg-white/10 px-4 py-3 text-center text-lg font-mono text-white placeholder-cyan-100/40 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      maxLength={6}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-cyan-100/80 mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full rounded-lg bg-white/10 px-4 py-3 text-white placeholder-cyan-100/40 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      maxLength={20}
                    />
                  </div>
                </div>

                <button
                  onClick={joinGame}
                  disabled={loading || !roomCode.trim() || !playerName.trim() || !user}
                  className="mt-6 w-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-3 font-semibold text-white transition hover:from-cyan-600 hover:to-emerald-600 disabled:opacity-50"
                >
                  {loading ? 'Joining...' : 'Join Game'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {!user && (
            <div className="rounded-lg bg-yellow-500/20 border border-yellow-500/30 px-4 py-3 text-sm text-yellow-200">
              <p className="mb-3">Please sign in to play multiplayer</p>
              <button
                onClick={() => setLoginModalOpen(true)}
                className="w-full rounded-full bg-yellow-500/30 px-4 py-2 text-sm font-medium text-yellow-100 transition hover:bg-yellow-500/40"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="rounded-lg bg-white/5 p-6">
            <div className="text-center mb-4">
              <h2 className="text-xl font-semibold text-white mb-2">{session.room_name}</h2>
              <div className="text-3xl font-mono text-cyan-300">{session.room_code}</div>
              <p className="text-sm text-cyan-100/60 mt-1">Host: {session.host_name}</p>
              <p className="text-sm text-cyan-100/60 mt-2">Share this code with friends</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-cyan-100/80">Players ({players.length}/2)</h3>
              {players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between rounded-lg p-3 ${
                    player.user_id === user?.id ? 'bg-white/10' : 'bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center text-white text-sm font-semibold">
                      {player.player_index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium">
                        {player.player_name}
                        {player.user_id === user?.id && ' (You)'}
                      </div>
                      <div className="text-xs text-cyan-100/60">
                        {player.is_online ? 'Online' : 'Offline'}
                        {player.player_index === 0 && ' - Host'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { playClick(); onBack() }}
              className="flex-1 rounded-full border border-white/20 bg-white/5 px-6 py-3 font-semibold text-cyan-100/90 transition hover:bg-white/10"
            >
              Leave Room
            </button>
            {canStart && (
              <button
                onClick={startGame}
                className="flex-1 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-3 font-semibold text-white transition hover:from-cyan-600 hover:to-emerald-600"
              >
                Start Game
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>
      )}
      
      <LoginModal 
        open={loginModalOpen} 
        onClose={() => setLoginModalOpen(false)} 
      />
    </div>
  )
}
