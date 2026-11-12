import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import * as favoritesService from './favorites.service';

const songParamsSchema = z.object({
  songId: z.string().uuid('Identificador de canción inválido'),
});

export async function listFavorites(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    const songs = await favoritesService.listFavoriteSongs(user.id);

    res.json({ songs });
  } catch (error) {
    next(error);
  }
}

export async function checkFavorite(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    const { songId } = songParamsSchema.parse(req.params);
    const isFavorite = await favoritesService.checkFavorite(user.id, songId);

    res.json({ isFavorite });
  } catch (error) {
    next(error);
  }
}

export async function addFavorite(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    const { songId } = songParamsSchema.parse(req.params);
    await favoritesService.addFavorite(user.id, songId);

    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function removeFavorite(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    const { songId } = songParamsSchema.parse(req.params);
    await favoritesService.removeFavorite(user.id, songId);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}
