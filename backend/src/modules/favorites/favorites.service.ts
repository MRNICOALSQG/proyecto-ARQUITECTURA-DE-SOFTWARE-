import * as favoritesRepository from './favorites.repository';
import type { Song } from '../songs/songs.repository';

export function listFavoriteSongs(userId: string): Promise<Song[]> {
  return favoritesRepository.findSongsByUser(userId);
}

export function checkFavorite(userId: string, songId: string): Promise<boolean> {
  return favoritesRepository.isFavorite(userId, songId);
}

export function addFavorite(userId: string, songId: string): Promise<void> {
  return favoritesRepository.add(userId, songId);
}

export function removeFavorite(userId: string, songId: string): Promise<void> {
  return favoritesRepository.remove(userId, songId);
}
