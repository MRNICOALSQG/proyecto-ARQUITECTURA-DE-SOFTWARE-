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

export interface AddSongResult {
  playlistExists: boolean;
  songExists: boolean;
  songOwnerId: string | null;
}

/**
 * Inserta la cancion en la playlist solo cuando la playlist pertenece al
 * usuario y la cancion tambien es suya.
 *
 * Playlist y cancion se resuelven en la misma sentencia que el INSERT para
 * evitar una ventana entre la comprobacion de propiedad y la insercion.
 * `FOR KEY SHARE` protege ambas filas frente a borrados concurrentes y
 * `ON CONFLICT DO NOTHING` conserva el comportamiento ante duplicados.
 * La playlist se filtra por `user_id`, de modo que una playlist ajena se
 * comporta igual que una inexistente y no revela informacion privada.
 */
export async function addSongIfOwned(
  userId: string,
  playlistId: string,
  songId: string
): Promise<AddSongResult> {
  const result = await query(
    `WITH target_playlist AS (
       SELECT id FROM playlists WHERE id = $1 AND user_id = $3 FOR KEY SHARE
     ), target_song AS (
       SELECT id, user_id FROM songs WHERE id = $2 FOR KEY SHARE
     ), inserted AS (
       INSERT INTO playlist_songs (playlist_id, song_id)
       SELECT p.id, s.id
       FROM target_playlist p, target_song s
       WHERE s.user_id = $3
       ON CONFLICT DO NOTHING
       RETURNING 1
     )
     SELECT
       EXISTS (SELECT 1 FROM target_playlist) AS playlist_exists,
       EXISTS (SELECT 1 FROM target_song) AS song_exists,
       (SELECT user_id FROM target_song) AS song_owner_id,
       EXISTS (SELECT 1 FROM inserted) AS inserted`,
    [playlistId, songId, userId]
  );

  const row = result.rows[0];
  return {
    playlistExists: row.playlist_exists,
    songExists: row.song_exists,
    songOwnerId: row.song_owner_id ?? null,
  };
}

export async function removeSong(playlistId: string, songId: string): Promise<void> {
  await query('DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2', [
    playlistId,
    songId,
  ]);
}
