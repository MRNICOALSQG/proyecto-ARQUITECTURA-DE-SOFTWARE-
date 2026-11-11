import fs from 'fs';
import path from 'path';
import { HttpError } from '../../shared/http-error';
import { sanitizeText } from '../../shared/sanitize';
import { deleteUploadIfExists, resolveUploadPath } from '../../shared/uploads';
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
    throw new HttpError(404, 'Canción no encontrada');
  }

  return song;
}

export async function getSongAudioFile(userId: string, songId: string): Promise<SongAudioFile> {
  const song = await getOwnedSong(userId, songId);
  const absolutePath = resolveUploadPath(song.file_path);

  if (!fs.existsSync(absolutePath)) {
    throw new HttpError(404, 'Archivo no encontrado');
  }

  return {
    song,
    absolutePath,
    size: fs.statSync(absolutePath).size,
  };
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
  const song = await songsRepository.updateTitleAndCover(
    songId,
    userId,
    title,
    input.coverPath || null
  );

  if (!song) {
    throw new HttpError(404, 'Canción no encontrada');
  }

  return song;
}

export async function deleteSong(userId: string, songId: string): Promise<void> {
  const song = await getOwnedSong(userId, songId);

  deleteUploadIfExists(song.file_path);
  deleteUploadIfExists(song.cover_path);

  await songsRepository.remove(song.id);
}
