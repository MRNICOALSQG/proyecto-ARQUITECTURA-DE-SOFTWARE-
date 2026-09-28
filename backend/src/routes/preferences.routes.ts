import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const preferencesSchema = z.object({
  background_type: z.enum(['solid', 'image']).optional(),
  background_value: z.string().max(500).optional(),
  hud_color: z.string().max(20).optional(),
  hud_opacity: z.number().min(0).max(1).optional(),
  particles_type: z.enum(['none', 'snow', 'particles', 'dots', 'lines']).optional(),
  particles_color: z.string().max(50).optional(),
  particles_speed: z.number().min(0.1).max(3).optional(),
  particles_opacity: z.number().min(0.1).max(1).optional(),
  background_size: z.string().max(50).optional(),
  background_position: z.string().max(50).optional(),
  background_repeat: z.string().max(50).optional(),
});

// GET /api/preferences - Get user preferences
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const result = await query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [user.id]
    );

    if (result.rows.length === 0) {
      return res.json({
        preferences: {
          background_type: 'solid',
          background_value: '#131315',
          hud_color: '#00dbe9',
          hud_opacity: 0.8,
          particles_type: 'none',
          particles_color: 'white',
          particles_speed: 1,
          particles_opacity: 0.5,
          background_size: 'cover',
          background_position: 'center',
          background_repeat: 'no-repeat',
        },
      });
    }

    res.json({ preferences: result.rows[0] });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Error al obtener preferencias' });
  }
});

// PUT /api/preferences - Update user preferences
router.put('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;
    const parsed = preferencesSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { 
      background_type, 
      background_value, 
      hud_color, 
      hud_opacity, 
      particles_type, 
      particles_color, 
      particles_speed, 
      particles_opacity,
      background_size,
      background_position,
      background_repeat
    } = parsed.data;

    const result = await query(
      `INSERT INTO user_preferences (user_id, background_type, background_value, hud_color, hud_opacity, particles_type, particles_color, particles_speed, particles_opacity, background_size, background_position, background_repeat, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         background_type = COALESCE($2, user_preferences.background_type),
         background_value = COALESCE($3, user_preferences.background_value),
         hud_color = COALESCE($4, user_preferences.hud_color),
         hud_opacity = COALESCE($5, user_preferences.hud_opacity),
         particles_type = COALESCE($6, user_preferences.particles_type),
         particles_color = COALESCE($7, user_preferences.particles_color),
         particles_speed = COALESCE($8, user_preferences.particles_speed),
         particles_opacity = COALESCE($9, user_preferences.particles_opacity),
         background_size = COALESCE($10, user_preferences.background_size),
         background_position = COALESCE($11, user_preferences.background_position),
         background_repeat = COALESCE($12, user_preferences.background_repeat),
         updated_at = NOW()
       RETURNING *`,
      [
        user.id, 
        background_type, 
        background_value, 
        hud_color, 
        hud_opacity, 
        particles_type, 
        particles_color, 
        particles_speed, 
        particles_opacity,
        background_size,
        background_position,
        background_repeat
      ]
    );

    res.json({ preferences: result.rows[0] });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Error al actualizar preferencias' });
  }
});

export default router;
