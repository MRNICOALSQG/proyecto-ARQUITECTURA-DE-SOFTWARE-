import multer from 'multer';
import { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { createUploader } from '../../shared/uploads';

const ALLOWED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/flac',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/x-flac',
  'audio/aac',
  'audio/mp4',
  'video/mp4',
  'audio/x-m4a',
];

export const uploadSongFiles = createUploader({
  folder: 'songs',
  allowedMimeTypes: ALLOWED_MIME_TYPES,
  maxFileSize: env.MAX_FILE_SIZE,
  invalidTypeMessage: 'Formato no compatible. Usa MP3, FLAC, OGG o WAV',
});

/** Traduce los errores de multer al contrato de error de la API. */
export function songsUploadErrorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxFileSizeMb = Math.round(env.MAX_FILE_SIZE / (1024 * 1024));
      res.status(400).json({ error: `El archivo excede el tamaño máximo de ${maxFileSizeMb}MB` });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }

  if (err) {
    res.status(400).json({ error: err.message });
  }
}
