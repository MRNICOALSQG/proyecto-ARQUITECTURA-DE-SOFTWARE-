import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/favorites - List all favorite songs
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const result = await query(
      `SELECT s.* FROM songs s
       INNER JOIN favorites f ON s.id = f.song_id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [user.id]
    );
    res.json({ songs: result.rows });
  } catch (error) {
    console.error('List favorites error:', error);
    res.status(500).json({ error: 'Error al obtener favoritos' });
  }
});

// GET /api/favorites/check/:songId - Check if song is favorited
router.get('/check/:songId', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const result = await query(
      'SELECT 1 FROM favorites WHERE user_id = $1 AND song_id = $2',
      [user.id, req.params.songId]
    );
    res.json({ isFavorite: result.rows.length > 0 });
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar favorito' });
  }
});

// POST /api/favorites/:songId - Add to favorites
router.post('/:songId', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    await query(
      'INSERT INTO favorites (user_id, song_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [user.id, req.params.songId]
    );
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al agregar a favoritos' });
  }
});

// DELETE /api/favorites/:songId - Remove from favorites
router.delete('/:songId', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    await query(
      'DELETE FROM favorites WHERE user_id = $1 AND song_id = $2',
      [user.id, req.params.songId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al quitar de favoritos' });
  }
});

export default router;
