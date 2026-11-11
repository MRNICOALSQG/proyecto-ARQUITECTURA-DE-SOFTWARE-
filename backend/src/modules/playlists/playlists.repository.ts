import { query } from '../../config/database';
import type { Song } from '../songs/songs.repository';

export interface Playlist {
  id: string;
  user_id: string;
  name: string;
  cover_url: string | null;
  created_at: string;
}

export async function findByUser(userId: string): Promise<Playlist[]> {
  const result = await query(
    'SELECT * FROM playlists WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

export async function create(
  userId: string,
  name: string,
  coverUrl: string | null
): Promise<Playlist> {
  const result = await query(
    'INSERT INTO playlists (user_id, name, cover_url) VALUES ($1, $2, $3) RETURNING *',
    [userId, name, coverUrl]
  );
  return result.rows[0];
}

export async function update(
  id: string,
  userId: string,
  name: string,
  coverUrl: string | null
): Promise<Playlist | undefined> {
  const result = await query(
    'UPDATE playlists SET name = $1, cover_url = COALESCE($2, cover_url) WHERE id = $3 AND user_id = $4 RETURNING *',
    [name, coverUrl, id, userId]
  );
  return result.rows[0];
}

export async function remove(id: string, userId: string): Promise<Playlist | undefined> {
  const result = await query(
    'DELETE FROM playlists WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );
  return result.rows[0];
}

export async function existsForUser(id: string, userId: string): Promise<boolean> {
  const result = await query('SELECT id FROM playlists WHERE id = $1 AND user_id = $2', [
    id,
    userId,
  ]);
  return result.rows.length > 0;
}

export async function findSongs(playlistId: string): Promise<Song[]> {
  const result = await query(
    `SELECT s.* FROM songs s
     JOIN playlist_songs ps ON s.id = ps.song_id
     WHERE ps.playlist_id = $1`,
    [playlistId]
  );
  return result.rows;
}

export async function addSong(playlistId: string, songId: string): Promise<void> {
  await query(
    'INSERT INTO playlist_songs (playlist_id, song_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [playlistId, songId]
  );
}

export async function removeSong(playlistId: string, songId: string): Promise<void> {
  await query('DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2', [
    playlistId,
    songId,
  ]);
}
