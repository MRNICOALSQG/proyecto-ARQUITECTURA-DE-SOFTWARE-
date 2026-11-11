import fs from 'fs';
import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import { sendControllerError, sendError } from '../../shared/http-response';
import { cleanTextSchema } from '../../shared/sanitize';
import { isUploadPublicPath } from '../../shared/uploads';
import * as songsService from './songs.service';

const updateSongSchema = z.object({
  title: cleanTextSchema({
    requiredMessage: 'El título es requerido',
    min: 1,
    max: 255,
    minMessage: 'El título es requerido',
    maxMessage: 'El título no puede superar los 255 caracteres',
  }),
  cover_path: z
    .string()
    .nullable()
    .optional()
    .refine((value) => value == null || isUploadPublicPath(value, 'images'), {
      message: 'La portada debe ser una ruta válida dentro de /uploads/images',
    }),
});

export async function listSongs(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    const search = req.query.search as string | undefined;
    const songs = await songsService.listSongs(user.id, search);

    res.json({ songs });
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al obtener canciones',
      logLabel: 'List songs error:',
    });
  }
}

export async function uploadSongs(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    if (files.length === 0) {
      sendError(res, 400, 'No se proporcionó archivo de audio');
      return;
    }

    const songs = await songsService.createSongsFromUploads(
      user.id,
      files,
      req.body.artist,
      req.body.album
    );

    res.status(201).json({ songs });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Formato no compatible')) {
      console.error('Upload error:', error);
      sendError(res, 400, error.message);
      return;
    }

    sendControllerError(res, error, {
      status: 500,
      message: 'Error al subir la canción',
      logLabel: 'Upload error:',
    });
  }
}

export async function streamSong(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    const { song, absolutePath, size } = await songsService.getSongAudioFile(
      user.id,
      req.params.id
    );

    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
      const chunkSize = end - start + 1;

      const stream = fs.createReadStream(absolutePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': song.mime_type || 'audio/mpeg',
      });
      stream.pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Length': size,
      'Content-Type': song.mime_type || 'audio/mpeg',
    });
    fs.createReadStream(absolutePath).pipe(res);
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al reproducir la canción',
      logLabel: 'Stream error:',
    });
  }
}

export async function updateSong(req: Request, res: Response): Promise<void> {
  try {
    const parsed = updateSongSchema.safeParse(req.body);

    if (!parsed.success) {
      sendError(res, 400, parsed.error.errors[0].message);
      return;
    }

    const user = (req as AuthRequest).user!;
    const song = await songsService.updateSong(user.id, req.params.id, {
      title: parsed.data.title,
      coverPath: parsed.data.cover_path,
    });

    res.json({ song });
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al actualizar la canción',
      logLabel: 'Update error:',
    });
  }
}

export async function deleteSong(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user!;
    await songsService.deleteSong(user.id, req.params.id);

    res.json({ message: 'Canción eliminada correctamente' });
  } catch (error) {
    sendControllerError(res, error, {
      status: 500,
      message: 'Error al eliminar la canción',
      logLabel: 'Delete error:',
    });
  }
}
