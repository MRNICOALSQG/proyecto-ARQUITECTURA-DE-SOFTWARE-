import fs from 'fs';
import path from 'path';
import { HttpError, NoEncontrado } from '../../shared/http-error';
import { sanitizeText } from '../../shared/sanitize';
import {
  deleteUploadIfExists,
  isUploadPublicPath,
  resolveUploadPath,
} from '../../shared/uploads';
import * as songsRepository from './songs.repository';
import type { Song } from './songs.repository';

const DEFAULT_ARTIST = 'Unknown Artist';
const DEFAULT_ALBUM = 'Unknown Album';

export interface UploadedAudioFile {
  originalname: string;
  filename: string;
  size: number;
  mimetype: string;
}

export interface SongAudioFile {
  song: Song;
  absolutePath: string;
  size: number;
}

export function listSongs(userId: string, search?: string): Promise<Song[]> {
  return songsRepository.findByUser(userId, search);
}

export async function createSongsFromUploads(
  userId: string,
  files: UploadedAudioFile[],
  artistInput?: string,
  albumInput?: string
): Promise<Song[]> {
  const artist = sanitizeText(artistInput || DEFAULT_ARTIST);
  const album = sanitizeText(albumInput || DEFAULT_ALBUM);
  const inserted: Song[] = [];

  for (const file of files) {
    const title = sanitizeText(path.parse(file.originalname).name);

    inserted.push(
      await songsRepository.insert({
        userId,
        title,
        artist,
        album,
        filePath: `/uploads/songs/${file.filename}`,
        fileSize: file.size,
        mimeType: file.mimetype,
      })
    );
  }

  return inserted;
}

export async function getOwnedSong(userId: string, songId: string): Promise<Song> {
  const song = await songsRepository.findByIdAndUser(songId, userId);

  if (!song) {
    throw new NoEncontrado('Canción no encontrada');
  }

  return song;
}

export async function getSongAudioFile(userId: string, songId: string): Promise<SongAudioFile> {
  const song = await getOwnedSong(userId, songId);

  let absolutePath: string;

  try {
    absolutePath = resolveUploadPath(song.file_path);
  } catch {
    // Una ruta corrupta en la base no debe escapar de UPLOAD_DIR; para el
    // cliente se comporta igual que un archivo inexistente.
    throw new NoEncontrado('Archivo no encontrado');
  }

  try {
    const stats = await fs.promises.stat(absolutePath);

    return {
      song,
      absolutePath,
      size: stats.size,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new NoEncontrado('Archivo no encontrado');
    }
    throw error;
  }
}

/**
 * Solo acepta `null`/`undefined` o una ruta canonica de imagen dentro de
 * `/uploads/images/`. Es la defensa del servicio contra H-02, independiente de
 * la validacion Zod del controlador.
 */
function normalizeCoverPath(coverPath?: string | null): string | null {
  if (coverPath == null) {
    return null;
  }

  if (!isUploadPublicPath(coverPath, 'images')) {
    throw new HttpError(400, 'La portada debe ser una ruta válida dentro de /uploads/images');
  }

  return coverPath;
}

export async function updateSong(
  userId: string,
  songId: string,
  input: { title?: string; coverPath?: string | null }
): Promise<Song> {
  if (!input.title) {
    throw new HttpError(400, 'El título es requerido');
  }

  const title = sanitizeText(input.title);
  const coverPath = normalizeCoverPath(input.coverPath);
  const song = await songsRepository.updateTitleAndCover(songId, userId, title, coverPath);

  if (!song) {
    throw new NoEncontrado('Canción no encontrada');
  }

  return song;
}

export async function deleteSong(userId: string, songId: string): Promise<void> {
  const song = await getOwnedSong(userId, songId);

  await deleteUploadIfExists(song.file_path);
  await deleteUploadIfExists(song.cover_path);

  await songsRepository.remove(song.id);
}
