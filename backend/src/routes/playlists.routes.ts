import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/playlists
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const result = await query('SELECT * FROM playlists WHERE user_id = $1 ORDER BY created_at DESC', [user.id]);
    res.json({ playlists: result.rows });
  } catch (error) {
    console.error('List playlists error:', error);
    res.status(500).json({ error: 'Error al obtener playlists' });
  }
});

// POST /api/playlists
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const { name, cover_url } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

    const safeName = name.replace(/[<>;"'&]/g, '');
    const result = await query(
      'INSERT INTO playlists (user_id, name, cover_url) VALUES ($1, $2, $3) RETURNING *',
      [user.id, safeName, cover_url || null]
    );
    res.status(201).json({ playlist: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear playlist' });
  }
});

// PUT /api/playlists/:id
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const { name, cover_url } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

    const safeName = name.replace(/[<>;"'&]/g, '');
    const result = await query(
      'UPDATE playlists SET name = $1, cover_url = COALESCE($2, cover_url) WHERE id = $3 AND user_id = $4 RETURNING *',
      [safeName, cover_url || null, req.params.id, user.id]
    );
    res.json({ playlist: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar playlist' });
  }
});

// DELETE /api/playlists/:id
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const result = await query('DELETE FROM playlists WHERE id = $1 AND user_id = $2 RETURNING *', [req.params.id, user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Playlist no encontrada' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar playlist' });
  }
});

router.get('/:id/songs', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const playlistId = req.params.id;
    // Check if playlist belongs to user
    const pl = await query('SELECT id FROM playlists WHERE id = $1 AND user_id = $2', [playlistId, user.id]);
    if (pl.rows.length === 0) return res.status(404).json({ error: 'Playlist no encontrada' });

    const result = await query(
      `SELECT s.* FROM songs s
       JOIN playlist_songs ps ON s.id = ps.song_id
       WHERE ps.playlist_id = $1`,
      [playlistId]
    );
    res.json({ songs: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener canciones de la playlist' });
  }
});

// POST /api/playlists/:id/songs
router.post('/:id/songs', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const playlistId = req.params.id;
    const { song_id } = req.body;

    const pl = await query('SELECT id FROM playlists WHERE id = $1 AND user_id = $2', [playlistId, user.id]);
    if (pl.rows.length === 0) return res.status(404).json({ error: 'Playlist no encontrada' });

    await query('INSERT INTO playlist_songs (playlist_id, song_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [playlistId, song_id]);
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al añadir canción' });
  }
});

// DELETE /api/playlists/:id/songs/:songId
router.delete('/:id/songs/:songId', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const playlistId = req.params.id;
    const songId = req.params.songId;

    const pl = await query('SELECT id FROM playlists WHERE id = $1 AND user_id = $2', [playlistId, user.id]);
    if (pl.rows.length === 0) return res.status(404).json({ error: 'Playlist no encontrada' });

    await query('DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2', [playlistId, songId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar canción de la playlist' });
  }
});

export default router;
