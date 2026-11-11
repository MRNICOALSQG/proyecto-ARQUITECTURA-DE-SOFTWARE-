import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { sendControllerError } from '../../shared/http-response';
import * as favoritesService from './favorites.service';

export async function listFavorites(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    const songs = await favoritesService.listFavoriteSongs(user.id);

    res.json({ songs });
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al obtener favoritos',
      logLabel: 'List favorites error:',
    });
  }
}

export async function checkFavorite(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    const isFavorite = await favoritesService.checkFavorite(user.id, req.params.songId);

    res.json({ isFavorite });
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al verificar favorito',
    });
  }
}

export async function addFavorite(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    await favoritesService.addFavorite(user.id, req.params.songId);

    res.status(201).json({ success: true });
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al agregar a favoritos',
    });
  }
}

export async function removeFavorite(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    await favoritesService.removeFavorite(user.id, req.params.songId);

    res.json({ success: true });
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al quitar de favoritos',
    });
  }
}
