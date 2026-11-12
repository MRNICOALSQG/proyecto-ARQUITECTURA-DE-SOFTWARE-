import { query } from '../../config/database';

export interface Song {
  id: string;
  user_id: string;
  title: string;
  artist: string;
  album: string;
  duration_seconds: number;
  file_path: string;
  file_size: number;
  mime_type: string;
  cover_path: string | null;
  uploaded_at: string;
}

export interface NewSong {
  userId: string;
  title: string;
  artist: string;
  album: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

export async function findByUser(userId: string, search?: string): Promise<Song[]> {
  let sql = 'SELECT * FROM songs WHERE user_id = $1';
  const params: string[] = [userId];

  if (search) {
    sql += ' AND (LOWER(title) LIKE $2 OR LOWER(artist) LIKE $2)';
    params.push(`%${search.toLowerCase()}%`);
  }

  sql += ' ORDER BY uploaded_at DESC';

  const result = await query(sql, params);
  return result.rows;
}

export async function findByIdAndUser(id: string, userId: string): Promise<Song | undefined> {
  const result = await query('SELECT * FROM songs WHERE id = $1 AND user_id = $2', [id, userId]);
  return result.rows[0];
}

/** Comprueba existencia sin exigir propiedad: la autorizacion es del Cambio 8. */
export async function exists(id: string): Promise<boolean> {
  const result = await query('SELECT id FROM songs WHERE id = $1', [id]);
  return result.rows.length > 0;
}

export async function insert(input: NewSong): Promise<Song> {
  const result = await query(
    `INSERT INTO songs (user_id, title, artist, album, duration_seconds, file_path, file_size, mime_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.userId,
      input.title,
      input.artist,
      input.album,
      0,
      input.filePath,
      input.fileSize,
      input.mimeType,
    ]
  );
  return result.rows[0];
}

export async function updateTitleAndCover(
  id: string,
  userId: string,
  title: string,
  coverPath: string | null
): Promise<Song | undefined> {
  const result = await query(
    'UPDATE songs SET title = $1, cover_path = COALESCE($2, cover_path) WHERE id = $3 AND user_id = $4 RETURNING *',
    [title, coverPath, id, userId]
  );
  return result.rows[0];
}

export async function remove(id: string): Promise<void> {
  await query('DELETE FROM songs WHERE id = $1', [id]);
}
