import { getSupabase } from './supabaseClient'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface GameSession {
  id: string
  room_code: string
  host_id: string
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

  async createGameSession(hostId: string, settings: {
    game_mode: 'solo' | 'two' | 'multiplayer'
    categories: string[]
    continents: string[]
    timer_enabled?: boolean
    timer_limit_sec?: number
  }): Promise<{ room_code: string; session: GameSession }> {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase not configured')

    const roomCode = this.generateRoomCode()
    
    const { data, error } = await supabase
      .from('game_sessions')
      .insert({
        room_code: roomCode,
        host_id: hostId,
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

    if (error) throw error
    
    return { room_code: roomCode, session: data }
  }

  async joinGameSession(roomCode: string, userId: string): Promise<GameSession> {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase not configured')

    // Get game session
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('room_code', roomCode)
      .single()

    if (sessionError) throw sessionError

    // Get current players to determine player index
    const { data: existingPlayers, error: playersError } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_session_id', session.id)

    if (playersError) throw playersError

    const playerIndex = existingPlayers.length

    // Add player to game
    const { error: joinError } = await supabase
      .from('game_players')
      .insert({
        game_session_id: session.id,
        user_id: userId,
        player_index: playerIndex,
        is_ready: false,
        is_online: true
      })

    if (joinError) throw joinError

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
        async () => {
          if (callbacks.onPlayerUpdate) {
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
        async () => {
          if (callbacks.onMoveUpdate) {
            const { data } = await supabase
              .from('game_moves')
              .select('*')
              .eq('game_session_id', sessionId)
              .order('move_number')
            callbacks.onMoveUpdate(data || [])
          }
        }
      )
      .subscribe()

    this.channels.set(sessionId, channel)
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

    // Get current move count
    const { data: existingMoves } = await supabase
      .from('game_moves')
      .select('move_number')
      .eq('game_session_id', sessionId)
      .order('move_number', { ascending: false })
      .limit(1)

    const moveNumber = (existingMoves?.[0]?.move_number || 0) + 1

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

    if (moveError) throw moveError

    // Update game session
    const { data: session } = await supabase
      .from('game_sessions')
      .select('current_chain, scores')
      .eq('id', sessionId)
      .single()

    if (session) {
      const newChain = [...(session.current_chain || []), moveText]
      const newScores = { ...(session.scores || {}), [playerId]: ((session.scores || {})[playerId] || 0) + points }

      await supabase
        .from('game_sessions')
        .update({
          current_chain: newChain,
          scores: newScores,
          current_turn_index: (playerIndex + 1) % 2 // Assuming 2 players for now
        })
        .eq('id', sessionId)
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

    const { error } = await supabase
      .from('game_sessions')
      .update({ status: 'playing' })
      .eq('id', sessionId)

    if (error) throw error
  }

  async getGameSession(roomCode: string): Promise<GameSession | null> {
    const supabase = getSupabase()
    if (!supabase) return null

    const { data, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('room_code', roomCode)
      .single()

    return error ? null : data
  }

  async getGamePlayers(sessionId: string): Promise<GamePlayer[]> {
    const supabase = getSupabase()
    if (!supabase) return []

    const { data, error } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_session_id', sessionId)
      .order('player_index')

    return error ? [] : data || []
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
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }
}

export const multiplayerService = new MultiplayerService()
