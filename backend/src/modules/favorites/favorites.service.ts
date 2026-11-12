import { HttpError, NoEncontrado } from '../../shared/http-error';
import * as favoritesRepository from './favorites.repository';
import type { Song } from '../songs/songs.repository';

export function listFavoriteSongs(userId: string): Promise<Song[]> {
  return favoritesRepository.findSongsByUser(userId);
}

export function checkFavorite(userId: string, songId: string): Promise<boolean> {
  return favoritesRepository.isFavorite(userId, songId);
}

export async function addFavorite(userId: string, songId: string): Promise<void> {
  const result = await favoritesRepository.addIfOwned(userId, songId);

  // Referencia inexistente -> 404 en lugar del error de clave foranea (500).
  if (!result.songExists) {
    throw new NoEncontrado('Canción no encontrada');
  }

  // La cancion existe pero no es del usuario autenticado.
  if (result.songOwnerId !== userId) {
    throw new HttpError(403, 'No autorizado para usar esta canción');
  }
}

export function removeFavorite(userId: string, songId: string): Promise<void> {
  return favoritesRepository.remove(userId, songId);
}
