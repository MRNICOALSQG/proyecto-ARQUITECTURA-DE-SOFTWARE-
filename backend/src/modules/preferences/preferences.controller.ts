import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import { sendControllerError, sendError } from '../../shared/http-response';
import * as preferencesService from './preferences.service';

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

export async function getPreferences(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    const preferences = await preferencesService.getPreferences(user.id);

    res.json({ preferences });
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al obtener preferencias',
      logLabel: 'Get preferences error:',
    });
  }
}

export async function updatePreferences(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    const parsed = preferencesSchema.safeParse(req.body);

    if (!parsed.success) {
      sendError(res, 400, parsed.error.errors[0].message);
      return;
    }

    const preferences = await preferencesService.updatePreferences(user.id, parsed.data);

    res.json({ preferences });
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al actualizar preferencias',
      logLabel: 'Update preferences error:',
    });
  }
}
