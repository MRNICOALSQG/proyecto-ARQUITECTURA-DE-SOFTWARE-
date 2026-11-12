import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
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

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);

    res.json(result);
  } catch (error) {
    next(error);
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

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = profileSchema.parse(req.body);
    const user = (req as AuthRequest).user!;
    const updated = await authService.updateProfile(user.id, {
      username: input.username,
      avatarUrl: input.avatar_url,
    });

    res.json({ user: updated });
  } catch (error) {
    next(error);
  }
}
