import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import { sendControllerError, sendError } from '../../shared/http-response';
import * as authService from './auth.service';

const registerSchema = z.object({
  email: z.string().email('Email no válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  username: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
});

const loginSchema = z.object({
  email: z.string().email('Email no válido'),
  password: z.string().min(1, 'La contraseña es requerida'),
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
    const user = (req as AuthRequest).user!;
    const updated = await authService.updateProfile(user.id, {
      username: req.body.username,
      avatarUrl: req.body.avatar_url,
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
