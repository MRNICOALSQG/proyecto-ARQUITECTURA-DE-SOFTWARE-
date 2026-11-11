import { HttpError } from '../../shared/http-error';
import { sanitizeText } from '../../shared/sanitize';
import * as playlistsRepository from './playlists.repository';
import type { Playlist } from './playlists.repository';
import type { Song } from '../songs/songs.repository';

export interface PlaylistInput {
  name?: string;
  coverUrl?: string | null;
}

/**
 * Unica comprobacion de pertenencia de playlists.
 *
 * Las tres operaciones sobre canciones de una playlist (listar, agregar y
 * quitar) y cualquier futura operacion deben pasar por aqui en lugar de repetir
 * la consulta `SELECT ... WHERE id = $1 AND user_id = $2`.
 */
export async function assertPlaylistOwner(playlistId: string, userId: string): Promise<void> {
  const exists = await playlistsRepository.existsForUser(playlistId, userId);

  if (!exists) {
    throw new HttpError(404, 'Playlist no encontrada');
  }
}

export function listPlaylists(userId: string): Promise<Playlist[]> {
  return playlistsRepository.findByUser(userId);
}

export async function createPlaylist(
  userId: string,
  input: PlaylistInput
): Promise<Playlist> {
  if (!input.name) {
    throw new HttpError(400, 'El nombre es requerido');
  }

  const name = sanitizeText(input.name);
  return playlistsRepository.create(userId, name, input.coverUrl || null);
}

// Se conserva el comportamiento historico: si la playlist no existe o no
// pertenece al usuario, la respuesta sigue siendo 200 y el controlador devuelve
// `{}` al serializar un `playlist` indefinido.
export async function updatePlaylist(
  userId: string,
  playlistId: string,
  input: PlaylistInput
): Promise<Playlist | undefined> {
  if (!input.name) {
    throw new HttpError(400, 'El nombre es requerido');
  }

  const name = sanitizeText(input.name);
  return playlistsRepository.update(playlistId, userId, name, input.coverUrl || null);
}

export async function deletePlaylist(userId: string, playlistId: string): Promise<void> {
  const deleted = await playlistsRepository.remove(playlistId, userId);

  if (!deleted) {
    throw new HttpError(404, 'Playlist no encontrada');
  }
}

export async function getPlaylistSongs(
  userId: string,
  playlistId: string
): Promise<Song[]> {
  await assertPlaylistOwner(playlistId, userId);
  return playlistsRepository.findSongs(playlistId);
}

export async function addSongToPlaylist(
  userId: string,
  playlistId: string,
  songId: string
): Promise<void> {
  await assertPlaylistOwner(playlistId, userId);
  await playlistsRepository.addSong(playlistId, songId);
}

export async function removeSongFromPlaylist(
  userId: string,
  playlistId: string,
  songId: string
): Promise<void> {
  await assertPlaylistOwner(playlistId, userId);
  await playlistsRepository.removeSong(playlistId, songId);
}
