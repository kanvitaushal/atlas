-- Multiplayer game tables for Atlas

-- User profiles and stats
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game sessions
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT UNIQUE NOT NULL,
  host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'finished')),
  game_mode TEXT NOT NULL CHECK (game_mode IN ('solo', 'two', 'multiplayer')),
  categories TEXT[] NOT NULL DEFAULT '{}',
  continents TEXT[] NOT NULL DEFAULT '{}',
  timer_enabled BOOLEAN DEFAULT false,
  timer_limit_sec INTEGER DEFAULT 300,
  current_turn_index INTEGER DEFAULT 0,
  current_chain TEXT[] DEFAULT '{}',
  scores JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Players in game sessions
CREATE TABLE IF NOT EXISTS game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  player_index INTEGER NOT NULL,
  is_ready BOOLEAN DEFAULT false,
  is_online BOOLEAN DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(game_session_id, user_id),
  UNIQUE(game_session_id, player_index)
);

-- Game moves history
CREATE TABLE IF NOT EXISTS game_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  player_index INTEGER NOT NULL,
  move_text TEXT NOT NULL,
  place_data JSONB,
  is_valid BOOLEAN NOT NULL,
  points INTEGER DEFAULT 0,
  move_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leaderboard entries
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  game_session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  final_score INTEGER NOT NULL,
  position INTEGER NOT NULL,
  players_count INTEGER NOT NULL,
  game_duration_sec INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Functions and triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_sessions_updated_at BEFORE UPDATE ON game_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view game sessions" ON game_sessions
    FOR SELECT USING (true);

CREATE POLICY "Users can create game sessions" ON game_sessions
    FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update own game sessions" ON game_sessions
    FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "Anyone can view game players" ON game_players
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert game players" ON game_players
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view game moves" ON game_moves
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert game moves" ON game_moves
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view leaderboard" ON leaderboard_entries
    FOR SELECT USING (true);

-- Indexes for performance
CREATE INDEX idx_game_sessions_room_code ON game_sessions(room_code);
CREATE INDEX idx_game_sessions_status ON game_sessions(status);
CREATE INDEX idx_game_players_session_id ON game_players(game_session_id);
CREATE INDEX idx_game_players_user_id ON game_players(user_id);
CREATE INDEX idx_game_moves_session_id ON game_moves(game_session_id);
CREATE INDEX idx_leaderboard_entries_user_id ON leaderboard_entries(user_id);
CREATE INDEX idx_leaderboard_entries_score ON leaderboard_entries(final_score DESC);
