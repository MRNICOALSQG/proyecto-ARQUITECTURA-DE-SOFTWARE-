import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { sendControllerError } from '../../shared/http-response';
import * as playlistsService from './playlists.service';

export async function listPlaylists(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    const playlists = await playlistsService.listPlaylists(user.id);

    res.json({ playlists });
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al obtener playlists',
      logLabel: 'List playlists error:',
    });
  }
}

export async function createPlaylist(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    const playlist = await playlistsService.createPlaylist(user.id, {
      name: req.body.name,
      coverUrl: req.body.cover_url,
    });

    res.status(201).json({ playlist });
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al crear playlist',
    });
  }
}

export async function updatePlaylist(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    const playlist = await playlistsService.updatePlaylist(user.id, req.params.id, {
      name: req.body.name,
      coverUrl: req.body.cover_url,
    });

    res.json({ playlist });
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al actualizar playlist',
    });
  }
}

export async function deletePlaylist(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    await playlistsService.deletePlaylist(user.id, req.params.id);

    res.json({ success: true });
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al eliminar playlist',
    });
  }
}

export async function listPlaylistSongs(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    const songs = await playlistsService.getPlaylistSongs(user.id, req.params.id);

    res.json({ songs });
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al obtener canciones de la playlist',
    });
  }
}

export async function addSongToPlaylist(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    await playlistsService.addSongToPlaylist(user.id, req.params.id, req.body.song_id);

    res.status(201).json({ success: true });
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al añadir canción',
    });
  }
}

export async function removeSongFromPlaylist(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    await playlistsService.removeSongFromPlaylist(user.id, req.params.id, req.params.songId);

    res.json({ success: true });
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al eliminar canción de la playlist',
    });
  }
}
