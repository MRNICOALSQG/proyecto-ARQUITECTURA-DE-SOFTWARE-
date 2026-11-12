import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import { sendControllerError, sendError } from '../../shared/http-response';
import { cleanTextSchema } from '../../shared/sanitize';
import * as authService from './auth.service';

const registerSchema = z.object({
  email: z.string().email('Email no válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  username: cleanTextSchema({
    requiredMessage: 'El nombre debe tener al menos 2 caracteres',
    min: 2,
    max: 100,
    minMessage: 'El nombre debe tener al menos 2 caracteres',
    maxMessage: 'El nombre no puede superar los 100 caracteres',
  }).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Email no válido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

const profileSchema = z.object({
  username: cleanTextSchema({
    requiredMessage: 'Username es requerido',
    min: 1,
    max: 100,
    minMessage: 'Username es requerido',
    maxMessage: 'Username no puede superar los 100 caracteres',
  }),
  avatar_url: z.string().nullable().optional(),
});

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      sendError(res, 400, parsed.error.errors[0].message);
      return;
    }

    const result = await authService.register(parsed.data);

    res.status(201).json(result);
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error interno del servidor',
      logLabel: 'Register error:',
    });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      sendError(res, 400, parsed.error.errors[0].message);
      return;
    }

    const result = await authService.login(parsed.data);

    res.json(result);
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error interno del servidor',
      logLabel: 'Login error:',
    });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    await authService.logout(req.headers.authorization);

    res.json({ message: 'Sesión cerrada correctamente' });
  } catch (error) {
    console.error('Logout error:', error);
    res.json({ message: 'Sesión cerrada' });
  }
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user;
  res.json({ user });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const parsed = profileSchema.safeParse(req.body);

    if (!parsed.success) {
      sendError(res, 400, parsed.error.errors[0].message);
      return;
    }

    const user = (req as AuthRequest).user!;
    const updated = await authService.updateProfile(user.id, {
      username: parsed.data.username,
      avatarUrl: parsed.data.avatar_url,
    });

    res.json({ user: updated });
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al actualizar perfil',
      logLabel: 'Update profile error:',
    });
  }
}
