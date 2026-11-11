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

export async function add(userId: string, songId: string): Promise<void> {
  await query(
    'INSERT INTO favorites (user_id, song_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, songId]
  );
}

export async function remove(userId: string, songId: string): Promise<void> {
  await query('DELETE FROM favorites WHERE user_id = $1 AND song_id = $2', [userId, songId]);
}
