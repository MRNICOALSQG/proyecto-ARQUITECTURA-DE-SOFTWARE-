import '../helpers/env';
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, NoEncontrado } from '../../src/shared/http-error';
import * as favoritesService from '../../src/modules/favorites/favorites.service';

type FavoritesRepository = typeof import('../../src/modules/favorites/favorites.repository');

const repository = require(
  '../../src/modules/favorites/favorites.repository'
) as FavoritesRepository;
const originalRepository = { ...repository };

function errorStatus(error: unknown): number | undefined {
  return error instanceof HttpError ? error.status : undefined;
}

describe('favorites.service', () => {
  afterEach(() => {
    Object.assign(repository, originalRepository);
  });

  it('agrega un favorito cuando la cancion pertenece al usuario', async () => {
    let received: unknown[] = [];
    repository.addIfOwned = async (...args: unknown[]) => {
      received = args;
      return { songExists: true, songOwnerId: 'user-a' };
    };

    await favoritesService.addFavorite('user-a', 'song-1');

    assert.deepEqual(received, ['user-a', 'song-1']);
  });

  it('mantiene el comportamiento de favorito duplicado sin lanzar error', async () => {
    repository.addIfOwned = async () => ({ songExists: true, songOwnerId: 'user-a' });

    await assert.doesNotReject(() => favoritesService.addFavorite('user-a', 'song-1'));
  });

  it('responde 404 cuando la cancion no existe', async () => {
    repository.addIfOwned = async () => ({ songExists: false, songOwnerId: null });

    await assert.rejects(
      () => favoritesService.addFavorite('user-a', 'missing'),
      (error) => error instanceof NoEncontrado && error.status === 404
    );
  });

  it('responde 403 cuando la cancion pertenece a otro usuario', async () => {
    repository.addIfOwned = async () => ({ songExists: true, songOwnerId: 'user-b' });

    await assert.rejects(
      () => favoritesService.addFavorite('user-a', 'song-b'),
      (error) => errorStatus(error) === 403
    );
  });

  it('delega el listado y la comprobacion en el repositorio', async () => {
    const songs = [{ id: 'song-1' }];
    repository.findSongsByUser = async (userId: string) => {
      assert.equal(userId, 'user-a');
      return songs as never;
    };
    repository.isFavorite = async (userId: string, songId: string) => {
      assert.equal(userId, 'user-a');
      assert.equal(songId, 'song-1');
      return true;
    };

    assert.equal(await favoritesService.listFavoriteSongs('user-a'), songs);
    assert.equal(await favoritesService.checkFavorite('user-a', 'song-1'), true);
  });

  it('elimina el favorito del usuario autenticado', async () => {
    let received: unknown[] = [];
    repository.remove = async (...args: unknown[]) => {
      received = args;
    };

    await favoritesService.removeFavorite('user-a', 'song-1');
    assert.deepEqual(received, ['user-a', 'song-1']);
  });
});
