import { query } from '../../config/database';
import type { Song } from '../songs/songs.repository';

export async function findSongsByUser(userId: string): Promise<Song[]> {
  const result = await query(
    `SELECT s.* FROM songs s
     INNER JOIN favorites f ON s.id = f.song_id
     WHERE f.user_id = $1
     ORDER BY f.created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function isFavorite(userId: string, songId: string): Promise<boolean> {
  const result = await query('SELECT 1 FROM favorites WHERE user_id = $1 AND song_id = $2', [
    userId,
    songId,
  ]);
  return result.rows.length > 0;
}

export interface AddFavoriteResult {
  songExists: boolean;
  songOwnerId: string | null;
}

/**
 * Inserta el favorito solo cuando la cancion existe y pertenece al usuario.
 *
 * La comprobacion y el INSERT se ejecutan en una sola sentencia para que la
 * propiedad no pueda quedar obsoleta entre ambas. `FOR KEY SHARE` impide que la
 * cancion se elimine mientras se crea la referencia. `ON CONFLICT DO NOTHING`
 * conserva el comportamiento previo ante favoritos duplicados.
 */
export async function addIfOwned(
  userId: string,
  songId: string
): Promise<AddFavoriteResult> {
  const result = await query(
    `WITH target_song AS (
       SELECT id, user_id FROM songs WHERE id = $2 FOR KEY SHARE
     ), inserted AS (
       INSERT INTO favorites (user_id, song_id)
       SELECT $1, id FROM target_song WHERE user_id = $1
       ON CONFLICT DO NOTHING
       RETURNING 1
     )
     SELECT
       EXISTS (SELECT 1 FROM target_song) AS song_exists,
       (SELECT user_id FROM target_song) AS song_owner_id,
       EXISTS (SELECT 1 FROM inserted) AS inserted`,
    [userId, songId]
  );

  const row = result.rows[0];
  return {
    songExists: row.song_exists,
    songOwnerId: row.song_owner_id ?? null,
  };
}

export async function remove(userId: string, songId: string): Promise<void> {
  await query('DELETE FROM favorites WHERE user_id = $1 AND song_id = $2', [userId, songId]);
}
