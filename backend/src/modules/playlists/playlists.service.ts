import { HttpError, NoEncontrado } from '../../shared/http-error';
import { sanitizeText } from '../../shared/sanitize';
import * as songsRepository from '../songs/songs.repository';
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
    throw new NoEncontrado('Playlist no encontrada');
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

export async function updatePlaylist(
  userId: string,
  playlistId: string,
  input: PlaylistInput
): Promise<Playlist> {
  if (!input.name) {
    throw new HttpError(400, 'El nombre es requerido');
  }

  const name = sanitizeText(input.name);
  const playlist = await playlistsRepository.update(
    playlistId,
    userId,
    name,
    input.coverUrl || null
  );

  // Un UPDATE que no devuelve fila significa que la playlist no existe o no
  // pertenece al usuario: el cliente recibe 404 en lugar de un 200 con `{}`.
  if (!playlist) {
    throw new NoEncontrado('Playlist no encontrada');
  }

  return playlist;
}

export async function deletePlaylist(userId: string, playlistId: string): Promise<void> {
  const deleted = await playlistsRepository.remove(playlistId, userId);

  if (!deleted) {
    throw new NoEncontrado('Playlist no encontrada');
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

  // Referencia inexistente -> 404 en lugar del error de clave foranea (500).
  // La propiedad de la cancion corresponde al Cambio 8.
  if (!(await songsRepository.exists(songId))) {
    throw new NoEncontrado('Canción no encontrada');
  }

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
