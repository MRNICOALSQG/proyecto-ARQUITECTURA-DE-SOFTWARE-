import { HttpError, NoEncontrado } from '../../shared/http-error';
import { sanitizeText } from '../../shared/sanitize';
import * as playlistsRepository from './playlists.repository';
import type { Playlist } from './playlists.repository';
import type { Song } from '../songs/songs.repository';

export interface PlaylistInput {
  name?: string;
  coverUrl?: string | null;
}

/**
 * Comprobacion de pertenencia para operaciones que leen o eliminan canciones
 * de una playlist.
 *
 * Agregar canciones usa `addSongIfOwned`, que resuelve la pertenencia en la
 * misma sentencia que el INSERT para no dejar una ventana entre la comprobacion
 * y la insercion. Cualquier otra operacion debe pasar por aqui en lugar de
 * repetir la consulta `SELECT ... WHERE id = $1 AND user_id = $2`.
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
  const result = await playlistsRepository.addSongIfOwned(userId, playlistId, songId);

  // La consulta filtra la playlist por propietario: una playlist ajena se
  // trata igual que una inexistente para no revelar informacion privada.
  if (!result.playlistExists) {
    throw new NoEncontrado('Playlist no encontrada');
  }

  // Referencia inexistente -> 404 en lugar del error de clave foranea (500).
  if (!result.songExists) {
    throw new NoEncontrado('Canción no encontrada');
  }

  // La cancion existe pero no es del usuario autenticado.
  if (result.songOwnerId !== userId) {
    throw new HttpError(403, 'No autorizado para usar esta canción');
  }
}

export async function removeSongFromPlaylist(
  userId: string,
  playlistId: string,
  songId: string
): Promise<void> {
  await assertPlaylistOwner(playlistId, userId);
  await playlistsRepository.removeSong(playlistId, songId);
}
