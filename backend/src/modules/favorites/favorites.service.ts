import { NoEncontrado } from '../../shared/http-error';
import * as songsRepository from '../songs/songs.repository';
import * as favoritesRepository from './favorites.repository';
import type { Song } from '../songs/songs.repository';

export function listFavoriteSongs(userId: string): Promise<Song[]> {
  return favoritesRepository.findSongsByUser(userId);
}

export function checkFavorite(userId: string, songId: string): Promise<boolean> {
  return favoritesRepository.isFavorite(userId, songId);
}

export async function addFavorite(userId: string, songId: string): Promise<void> {
  // Referencia inexistente -> 404 en lugar del error de clave foranea (500).
  // La propiedad de la cancion corresponde al Cambio 8.
  if (!(await songsRepository.exists(songId))) {
    throw new NoEncontrado('Canción no encontrada');
  }

  await favoritesRepository.add(userId, songId);
}

export function removeFavorite(userId: string, songId: string): Promise<void> {
  return favoritesRepository.remove(userId, songId);
}
