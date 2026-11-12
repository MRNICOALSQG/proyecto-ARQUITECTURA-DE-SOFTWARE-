import '../helpers/env';
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, NoEncontrado } from '../../src/shared/http-error';
import * as playlistsService from '../../src/modules/playlists/playlists.service';

type PlaylistsRepository = typeof import('../../src/modules/playlists/playlists.repository');

const repository = require(
  '../../src/modules/playlists/playlists.repository'
) as PlaylistsRepository;
const originalRepository = { ...repository };

function errorStatus(error: unknown): number | undefined {
  return error instanceof HttpError ? error.status : undefined;
}

describe('playlists.service', () => {
  afterEach(() => {
    Object.assign(repository, originalRepository);
  });

  it('crea una playlist saneando el nombre', async () => {
    let received: unknown[] = [];
    repository.create = async (...args: unknown[]) => {
      received = args;
      return { id: 'playlist-1', user_id: 'user-a', name: 'My List', cover_url: null, created_at: '' };
    };

    const playlist = await playlistsService.createPlaylist('user-a', { name: '<My List>' });

    assert.equal(playlist.name, 'My List');
    assert.deepEqual(received, ['user-a', 'My List', null]);
  });

  it('rechaza crear una playlist sin nombre', async () => {
    // La validacion de espacios y longitudes vive en el controlador (Zod); el
    // servicio solo garantiza que exista un nombre.
    await assert.rejects(
      () => playlistsService.createPlaylist('user-a', { name: '' }),
      (error) => errorStatus(error) === 400
    );
    await assert.rejects(
      () => playlistsService.createPlaylist('user-a', {}),
      (error) => errorStatus(error) === 400
    );
  });

  it('actualiza una playlist propia y responde 404 si no existe', async () => {
    repository.update = async () => ({
      id: 'playlist-1',
      user_id: 'user-a',
      name: 'Renamed',
      cover_url: null,
      created_at: '',
    });

    const updated = await playlistsService.updatePlaylist('user-a', 'playlist-1', {
      name: 'Renamed',
    });
    assert.equal(updated.name, 'Renamed');

    repository.update = async () => undefined;
    await assert.rejects(
      () => playlistsService.updatePlaylist('user-a', 'missing', { name: 'X' }),
      (error) => error instanceof NoEncontrado && error.status === 404
    );
  });

  it('elimina una playlist propia y responde 404 si no existe', async () => {
    repository.remove = async () => ({ id: 'playlist-1' } as never);
    await assert.doesNotReject(() => playlistsService.deletePlaylist('user-a', 'playlist-1'));

    repository.remove = async () => undefined;
    await assert.rejects(
      () => playlistsService.deletePlaylist('user-a', 'missing'),
      (error) => error instanceof NoEncontrado
    );
  });

  it('solo lista canciones de una playlist propia', async () => {
    repository.existsForUser = async () => false;
    await assert.rejects(
      () => playlistsService.getPlaylistSongs('user-a', 'foreign'),
      (error) => error instanceof NoEncontrado
    );

    repository.existsForUser = async () => true;
    repository.findSongs = async () => [{ id: 'song-1' }] as never;
    const songs = await playlistsService.getPlaylistSongs('user-a', 'playlist-1');
    assert.deepEqual(songs, [{ id: 'song-1' }]);
  });

  it('agrega una cancion propia a una playlist propia', async () => {
    let received: unknown[] = [];
    repository.addSongIfOwned = async (...args: unknown[]) => {
      received = args;
      return { playlistExists: true, songExists: true, songOwnerId: 'user-a' };
    };

    await playlistsService.addSongToPlaylist('user-a', 'playlist-1', 'song-1');
    assert.deepEqual(received, ['user-a', 'playlist-1', 'song-1']);
  });

  it('mantiene el comportamiento de duplicado sin lanzar error', async () => {
    repository.addSongIfOwned = async () => ({
      playlistExists: true,
      songExists: true,
      songOwnerId: 'user-a',
    });

    await assert.doesNotReject(() =>
      playlistsService.addSongToPlaylist('user-a', 'playlist-1', 'song-1')
    );
  });

  it('responde 404 si la playlist no existe o es ajena', async () => {
    repository.addSongIfOwned = async () => ({
      playlistExists: false,
      songExists: true,
      songOwnerId: 'user-a',
    });

    await assert.rejects(
      () => playlistsService.addSongToPlaylist('user-a', 'foreign', 'song-1'),
      (error) => error instanceof NoEncontrado && error.status === 404
    );
  });

  it('responde 404 si la cancion no existe', async () => {
    repository.addSongIfOwned = async () => ({
      playlistExists: true,
      songExists: false,
      songOwnerId: null,
    });

    await assert.rejects(
      () => playlistsService.addSongToPlaylist('user-a', 'playlist-1', 'missing'),
      (error) => error instanceof NoEncontrado && error.status === 404
    );
  });

  it('responde 403 si la cancion pertenece a otro usuario', async () => {
    repository.addSongIfOwned = async () => ({
      playlistExists: true,
      songExists: true,
      songOwnerId: 'user-b',
    });

    await assert.rejects(
      () => playlistsService.addSongToPlaylist('user-a', 'playlist-1', 'song-b'),
      (error) => errorStatus(error) === 403
    );
  });

  it('solo elimina canciones de una playlist propia', async () => {
    let removed: unknown[] = [];
    repository.existsForUser = async () => true;
    repository.removeSong = async (...args: unknown[]) => {
      removed = args;
    };

    await playlistsService.removeSongFromPlaylist('user-a', 'playlist-1', 'song-1');
    assert.deepEqual(removed, ['playlist-1', 'song-1']);

    repository.existsForUser = async () => false;
    await assert.rejects(
      () => playlistsService.removeSongFromPlaylist('user-a', 'foreign', 'song-1'),
      (error) => error instanceof NoEncontrado
    );
  });

  it('lista las playlists del usuario autenticado', async () => {
    repository.findByUser = async (userId: string) => {
      assert.equal(userId, 'user-a');
      return [{ id: 'playlist-1' }] as never;
    };

    assert.deepEqual(await playlistsService.listPlaylists('user-a'), [{ id: 'playlist-1' }]);
  });
});
