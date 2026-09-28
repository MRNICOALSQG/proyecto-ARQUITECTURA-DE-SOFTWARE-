-- ============================================
-- Rin'ne Database Schema
-- PostgreSQL 15
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Users table
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- Songs table
-- ============================================
CREATE TABLE songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) DEFAULT 'Unknown Artist',
  album VARCHAR(255) DEFAULT 'Unknown Album',
  duration_seconds INTEGER DEFAULT 0,
  file_path VARCHAR(500) NOT NULL,
  cover_path VARCHAR(500),
  file_size BIGINT DEFAULT 0,
  mime_type VARCHAR(100) DEFAULT 'audio/mpeg',
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_songs_user_id ON songs(user_id);
CREATE INDEX idx_songs_title ON songs(title);
CREATE INDEX idx_songs_artist ON songs(artist);

-- ============================================
-- User Preferences table (HUD customization)
-- ============================================
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  background_type VARCHAR(50) DEFAULT 'solid',
  background_value VARCHAR(500) DEFAULT '#131315',
  hud_color VARCHAR(7) DEFAULT '#00dbe9',
  hud_opacity FLOAT DEFAULT 0.8,
  particles_type VARCHAR(50) DEFAULT 'none',
  particles_color VARCHAR(50) DEFAULT 'white',
  particles_speed FLOAT DEFAULT 1,
  particles_opacity FLOAT DEFAULT 0.5,
  background_size VARCHAR(50) DEFAULT 'cover',
  background_position VARCHAR(50) DEFAULT 'center',
  background_repeat VARCHAR(50) DEFAULT 'no-repeat',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Playlists table
-- ============================================
CREATE TABLE playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  cover_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_playlists_user_id ON playlists(user_id);

-- ============================================
-- Playlist Songs (junction table)
-- ============================================
CREATE TABLE playlist_songs (
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (playlist_id, song_id)
);

-- ============================================
-- Favorites table
-- ============================================
CREATE TABLE favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, song_id)
);

CREATE INDEX idx_favorites_user_id ON favorites(user_id);


-- ============================================
-- Revoked tokens table (for logout)
-- ============================================
CREATE TABLE revoked_tokens (
  id SERIAL PRIMARY KEY,
  token_jti VARCHAR(255) UNIQUE NOT NULL,
  revoked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_revoked_tokens_jti ON revoked_tokens(token_jti);

-- ============================================
-- Auto-create preferences on user insert
-- ============================================
CREATE OR REPLACE FUNCTION create_default_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_preferences (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_preferences
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_default_preferences();
