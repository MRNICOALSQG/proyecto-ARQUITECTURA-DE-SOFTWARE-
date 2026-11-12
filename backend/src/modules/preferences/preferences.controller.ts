import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import * as preferencesService from './preferences.service';

const preferencesSchema = z.object({
  background_type: z
    .enum(['solid', 'image'], { errorMap: () => ({ message: 'Tipo de fondo inválido' }) })
    .optional(),
  background_value: z
    .string()
    .max(500, 'El fondo no puede superar los 500 caracteres')
    .optional(),
  hud_color: z.string().max(20, 'El color del HUD no puede superar los 20 caracteres').optional(),
  hud_opacity: z
    .number({ invalid_type_error: 'La opacidad del HUD debe ser un número' })
    .min(0, 'La opacidad del HUD debe estar entre 0 y 1')
    .max(1, 'La opacidad del HUD debe estar entre 0 y 1')
    .optional(),
  particles_type: z
    .enum(['none', 'snow', 'particles', 'dots', 'lines'], {
      errorMap: () => ({ message: 'Tipo de partículas inválido' }),
    })
    .optional(),
  particles_color: z
    .string()
    .max(50, 'El color de partículas no puede superar los 50 caracteres')
    .optional(),
  particles_speed: z
    .number({ invalid_type_error: 'La velocidad de partículas debe ser un número' })
    .min(0.1, 'La velocidad de partículas debe estar entre 0.1 y 3')
    .max(3, 'La velocidad de partículas debe estar entre 0.1 y 3')
    .optional(),
  particles_opacity: z
    .number({ invalid_type_error: 'La opacidad de partículas debe ser un número' })
    .min(0.1, 'La opacidad de partículas debe estar entre 0.1 y 1')
    .max(1, 'La opacidad de partículas debe estar entre 0.1 y 1')
    .optional(),
  background_size: z
    .string()
    .max(50, 'El tamaño de fondo no puede superar los 50 caracteres')
    .optional(),
  background_position: z
    .string()
    .max(50, 'La posición de fondo no puede superar los 50 caracteres')
    .optional(),
  background_repeat: z
    .string()
    .max(50, 'La repetición de fondo no puede superar los 50 caracteres')
    .optional(),
});

export async function getPreferences(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    const preferences = await preferencesService.getPreferences(user.id);

    res.json({ preferences });
  } catch (error) {
    next(error);
  }
}

export async function updatePreferences(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = preferencesSchema.parse(req.body);
    const user = (req as AuthRequest).user!;
    const preferences = await preferencesService.updatePreferences(user.id, input);

    res.json({ preferences });
  } catch (error) {
    next(error);
  }
}
