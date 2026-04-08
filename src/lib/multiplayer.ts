import { getSupabase } from './supabaseClient'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface GameSession {
  id: string
  room_code: string
  room_name: string
  host_id: string
  host_name: string
  status: 'waiting' | 'playing' | 'finished'
  game_mode: 'solo' | 'two' | 'multiplayer'
  categories: string[]
  continents: string[]
  timer_enabled: boolean
  timer_limit_sec: number
  current_turn_index: number
  current_chain: string[]
  scores: Record<string, number>
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

export interface GamePlayer {
  id: string
  game_session_id: string
  user_id: string
  player_name: string
  player_index: number
  is_ready: boolean
  is_online: boolean
  joined_at: string
}

export interface GameMove {
  id: string
  game_session_id: string
  player_id: string
  player_index: number
  move_text: string
  place_data?: any
  is_valid: boolean
  points: number
  move_number: number
  created_at: string
}

export interface UserProfile {
  id: string
  user_id: string
  username: string
  avatar_url?: string
  games_played: number
  games_won: number
  total_score: number
  created_at: string
  updated_at: string
}

class MultiplayerService {
  private channels: Map<string, RealtimeChannel> = new Map()

  async createGameSession(hostId: string, hostName: string, roomName: string, settings: {
    game_mode: 'solo' | 'two' | 'multiplayer'
    categories: string[]
    continents: string[]
    timer_enabled?: boolean
    timer_limit_sec?: number
  }): Promise<{ room_code: string; session: GameSession }> {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase not configured')

    console.log('MultiplayerService: Creating game session', { hostId, hostName, roomName })

    const roomCode = this.generateRoomCode()
    
    // Create the game session
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .insert({
        room_code: roomCode,
        room_name: roomName,
        host_id: hostId,
        host_name: hostName,
        status: 'waiting',
        game_mode: settings.game_mode,
        categories: settings.categories,
        continents: settings.continents,
        timer_enabled: settings.timer_enabled || false,
        timer_limit_sec: settings.timer_limit_sec || 300,
        scores: {}
      })
      .select()
      .single()

    if (sessionError) {
      console.error('MultiplayerService: Failed to create session', sessionError)
      throw sessionError
    }

    console.log('MultiplayerService: Session created', session)

    // Add host as first player
    const { data: hostPlayer, error: playerError } = await supabase
      .from('game_players')
      .insert({
        game_session_id: session.id,
        user_id: hostId,
        player_name: hostName,
        player_index: 0,
        is_ready: false,
        is_online: true
      })
      .select()
      .single()

    if (playerError) {
      console.error('MultiplayerService: Failed to add host to players', playerError)
      throw playerError
    }

    console.log('MultiplayerService: Host added to players', hostPlayer)
    
    return { room_code: roomCode, session }
  }

  async joinGameSession(roomCode: string, userId: string, playerName: string): Promise<GameSession> {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase not configured')

    console.log('MultiplayerService: Joining game session', { roomCode, userId, playerName })

    // Get game session
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('room_code', roomCode)
      .single()

    if (sessionError) {
      console.error('MultiplayerService: Failed to get session', sessionError)
      throw sessionError
    }

    console.log('MultiplayerService: Found session', session)

    // Get current players to determine player index
    const { data: existingPlayers, error: playersError } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_session_id', session.id)

    if (playersError) {
      console.error('MultiplayerService: Failed to get existing players', playersError)
      throw playersError
    }

    console.log('MultiplayerService: Existing players', existingPlayers)

    // Check if user is already in the game
    const existingPlayer = existingPlayers?.find(p => p.user_id === userId)
    if (existingPlayer) {
      console.log('MultiplayerService: User already in game', existingPlayer)
      return session
    }

    const playerIndex = existingPlayers?.length || 0

    // Add player to game
    const { data: newPlayer, error: joinError } = await supabase
      .from('game_players')
      .insert({
        game_session_id: session.id,
        user_id: userId,
        player_name: playerName,
        player_index: playerIndex,
        is_ready: false,
        is_online: true
      })
      .select()
      .single()

    if (joinError) {
      console.error('MultiplayerService: Failed to add player', joinError)
      throw joinError
    }

    console.log('MultiplayerService: Player added successfully', newPlayer)

    return session
  }

  async subscribeToGameSession(
    sessionId: string,
    callbacks: {
      onSessionUpdate?: (session: GameSession) => void
      onPlayerUpdate?: (players: GamePlayer[]) => void
      onMoveUpdate?: (moves: GameMove[]) => void
    }
  ): Promise<RealtimeChannel> {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase not configured')

    console.log('Setting up subscription for session:', sessionId)

    const channel = supabase
      .channel(`game-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          console.log('Session update:', payload)
          if (payload.new && callbacks.onSessionUpdate) {
            callbacks.onSessionUpdate(payload.new as GameSession)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_players',
          filter: `game_session_id=eq.${sessionId}`
        },
        async (payload) => {
          console.log('Player update:', payload)
          if (callbacks.onPlayerUpdate) {
            // Always fetch fresh data when there's a change
            const { data } = await supabase
              .from('game_players')
              .select('*')
              .eq('game_session_id', sessionId)
              .order('player_index')
            callbacks.onPlayerUpdate(data || [])
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_moves',
          filter: `game_session_id=eq.${sessionId}`
        },
        async (payload) => {
          console.log('Move update received:', payload)
          console.log('Move update payload type:', payload.eventType)
          console.log('Move update payload data:', payload.new)
          
          if (callbacks.onMoveUpdate) {
            const { data } = await supabase
              .from('game_moves')
              .select('*')
              .eq('game_session_id', sessionId)
              .order('move_number')
            
            console.log('Fetched moves from database:', data)
            callbacks.onMoveUpdate(data || [])
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          console.log('Session update:', payload)
          if (payload.new && callbacks.onSessionUpdate) {
            callbacks.onSessionUpdate(payload.new as GameSession)
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status changed:', status)
        if (status === 'SUBSCRIBED') {
          console.log('MultiplayerService: Subscription SUBSCRIBED successfully')
        } else if (status === 'CLOSED') {
          console.error('MultiplayerService: Subscription CLOSED - this is the issue!')
          console.error('MultiplayerService: Attempting to resubscribe...')
          // Attempt to resubscribe automatically
          setTimeout(() => {
            this.subscribeToGameSession(sessionId, callbacks)
          }, 1000)
        }
      })

    this.channels.set(sessionId, channel)
    console.log('MultiplayerService: Subscription setup complete for session', sessionId)
    return channel
  }

  async makeMove(
    sessionId: string,
    playerId: string,
    playerIndex: number,
    moveText: string,
    placeData?: any,
    isValid: boolean = true,
    points: number = 1
  ): Promise<void> {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase not configured')

    console.log('MultiplayerService: makeMove called', { sessionId, playerId, playerIndex, moveText, isValid, points })

    // Get current move count
    const { data: existingMoves } = await supabase
      .from('game_moves')
      .select('move_number')
      .eq('game_session_id', sessionId)
      .order('move_number', { ascending: false })
      .limit(1)

    const moveNumber = (existingMoves?.[0]?.move_number || 0) + 1
    console.log('MultiplayerService: Move number calculated', moveNumber)

    // Insert move
    const { error: moveError } = await supabase
      .from('game_moves')
      .insert({
        game_session_id: sessionId,
        player_id: playerId,
        player_index: playerIndex,
        move_text: moveText,
        place_data: placeData,
        is_valid: isValid,
        points: points,
        move_number: moveNumber
      })

    if (moveError) {
      console.error('MultiplayerService: Failed to insert move', moveError)
      throw moveError
    }

    console.log('MultiplayerService: Move inserted successfully')

    // Update game session
    const { data: session } = await supabase
      .from('game_sessions')
      .select('current_chain, scores')
      .eq('id', sessionId)
      .single()

    if (session) {
      const newChain = [...(session.current_chain || []), moveText]
      const newScores = { ...(session.scores || {}), [playerId]: ((session.scores || {})[playerId] || 0) + points }

      console.log('MultiplayerService: Updating session', { newChain, newScores })

      await supabase
        .from('game_sessions')
        .update({
          current_chain: newChain,
          scores: newScores
          // NOTE: Turn update handled by updateCurrentTurn() function
        })
        .eq('id', sessionId)

      console.log('MultiplayerService: Session updated successfully')
    }
  }

  async setPlayerReady(sessionId: string, userId: string, isReady: boolean): Promise<void> {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase
      .from('game_players')
      .update({ is_ready: isReady })
      .eq('game_session_id', sessionId)
      .eq('user_id', userId)

    if (error) throw error
  }

  async startGame(sessionId: string): Promise<void> {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase not configured')

    console.log('MultiplayerService: Starting game', sessionId)

    const { error } = await supabase
      .from('game_sessions')
      .update({ status: 'playing' })
      .eq('id', sessionId)

    if (error) {
      console.error('MultiplayerService: Failed to start game', error)
      throw error
    }

    console.log('MultiplayerService: Game started successfully')
  }

  async updateCurrentTurn(sessionId: string, playerIndex: number): Promise<void> {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase not configured')

    console.log('MultiplayerService: Updating current turn DYNAMICALLY', { sessionId, playerIndex, totalPlayers: 'dynamic' })
    
    const { error } = await supabase
      .from('game_sessions')
      .update({ current_turn_index: playerIndex })
      .eq('id', sessionId)

    if (error) {
      console.error('MultiplayerService: Failed to update turn', error)
      throw error
    }

    console.log('TURN UPDATE TRIGGERED FROM: DATABASE_UPDATE, value:', playerIndex)
    console.log('MultiplayerService: Turn updated successfully in database', { sessionId, newTurnIndex: playerIndex })
  }

  async getGameSession(roomCode: string): Promise<GameSession | null> {
    const supabase = getSupabase()
    if (!supabase) return null

    const { data, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('room_code', roomCode)
      .single()

    if (error) return null
    return data
  }

  async getGameSessionById(sessionId: string): Promise<GameSession | null> {
    const supabase = getSupabase()
    if (!supabase) return null

    console.log('MultiplayerService: Getting session by ID', sessionId)

    const { data, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error) {
      console.error('MultiplayerService: Failed to get session by ID', error)
      return null
    }

    console.log('MultiplayerService: Session found by ID', data)
    return data
  }

  async getGamePlayers(sessionId: string): Promise<GamePlayer[]> {
    const supabase = getSupabase()
    if (!supabase) return []

    console.log('MultiplayerService: Getting players for session', sessionId)

    const { data, error } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_session_id', sessionId)
      .order('player_index')

    if (error) {
      console.error('MultiplayerService: Failed to get players', error)
      return []
    }

    console.log('MultiplayerService: Players loaded', data)
    return data || []
  }

  async getGameMoves(sessionId: string): Promise<GameMove[]> {
    const supabase = getSupabase()
    if (!supabase) return []

    const { data, error } = await supabase
      .from('game_moves')
      .select('*')
      .eq('game_session_id', sessionId)
      .order('move_number')

    return error ? [] : data || []
  }

  unsubscribe(sessionId: string): void {
    const channel = this.channels.get(sessionId)
    if (channel) {
      channel.unsubscribe()
      this.channels.delete(sessionId)
    }
  }

  private generateRoomCode(): string {
    const chars = '0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }
}

export const multiplayerService = new MultiplayerService()
