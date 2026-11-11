import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';

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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const songsDir = path.join(env.UPLOAD_DIR, 'songs');
    if (!fs.existsSync(songsDir)) {
      fs.mkdirSync(songsDir, { recursive: true });
    }
    cb(null, songsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const uploadSongFiles = multer({
  storage,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato no compatible. Usa MP3, FLAC, OGG o WAV'));
    }
  },
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
