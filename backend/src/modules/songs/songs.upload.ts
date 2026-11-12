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
