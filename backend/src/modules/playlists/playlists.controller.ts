import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import { cleanTextSchema } from '../../shared/sanitize';
import * as playlistsService from './playlists.service';

const playlistSchema = z.object({
  name: cleanTextSchema({
    requiredMessage: 'El nombre es requerido',
    min: 1,
    max: 255,
    minMessage: 'El nombre es requerido',
    maxMessage: 'El nombre no puede superar los 255 caracteres',
  }),
  cover_url: z.string().nullable().optional(),
});

const playlistParamsSchema = z.object({
  id: z.string().uuid('Identificador de playlist inválido'),
});

const playlistSongParamsSchema = z.object({
  id: z.string().uuid('Identificador de playlist inválido'),
  songId: z.string().uuid('Identificador de canción inválido'),
});

const addSongSchema = z.object({
  song_id: z.string().uuid('Identificador de canción inválido'),
});

export async function listPlaylists(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    const playlists = await playlistsService.listPlaylists(user.id);

    res.json({ playlists });
  } catch (error) {
    next(error);
  }
}

export async function createPlaylist(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = playlistSchema.parse(req.body);
    const user = (req as AuthRequest).user!;
    const playlist = await playlistsService.createPlaylist(user.id, {
      name: input.name,
      coverUrl: input.cover_url,
    });

    res.status(201).json({ playlist });
  } catch (error) {
    next(error);
  }
}

export async function updatePlaylist(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = playlistSchema.parse(req.body);
    const { id } = playlistParamsSchema.parse(req.params);
    const user = (req as AuthRequest).user!;
    const playlist = await playlistsService.updatePlaylist(user.id, id, {
      name: input.name,
      coverUrl: input.cover_url,
    });

    res.json({ playlist });
  } catch (error) {
    next(error);
  }
}

export async function deletePlaylist(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = playlistParamsSchema.parse(req.params);
    const user = (req as AuthRequest).user!;
    await playlistsService.deletePlaylist(user.id, id);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function listPlaylistSongs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = playlistParamsSchema.parse(req.params);
    const user = (req as AuthRequest).user!;
    const songs = await playlistsService.getPlaylistSongs(user.id, id);

    res.json({ songs });
  } catch (error) {
    next(error);
  }
}

export async function addSongToPlaylist(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = playlistParamsSchema.parse(req.params);
    const { song_id: songId } = addSongSchema.parse(req.body);
    const user = (req as AuthRequest).user!;
    await playlistsService.addSongToPlaylist(user.id, id, songId);

    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function removeSongFromPlaylist(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id, songId } = playlistSongParamsSchema.parse(req.params);
    const user = (req as AuthRequest).user!;
    await playlistsService.removeSongFromPlaylist(user.id, id, songId);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}
