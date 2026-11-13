import '../helpers/env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { pool } from '../../src/config/database';
import { integrationSkipReason } from '../helpers/env';
import {
  closeDatabase,
  countRows,
  createPlaylist,
  createSong,
  createUser,
  prepareDatabase,
} from '../helpers/db';
import * as favoritesRepository from '../../src/modules/favorites/favorites.repository';
import * as playlistsRepository from '../../src/modules/playlists/playlists.repository';

describe('Cambio 8: consultas de propiedad (PostgreSQL real)', { skip: integrationSkipReason() }, () => {
  before(async () => {
    await prepareDatabase();
  });

  after(async () => {
    await closeDatabase();
  });

  it('addIfOwned inserta el favorito de una cancion propia', async () => {
    const user = await createUser();
    const song = await createSong(user.id);

    const result = await favoritesRepository.addIfOwned(user.id, song.id);

    assert.deepEqual(result, { songExists: true, songOwnerId: user.id });
    assert.equal(
      await countRows('favorites', 'user_id = $1 AND song_id = $2', [user.id, song.id]),
      1
    );
  });

  it('addIfOwned conserva el comportamiento de duplicado', async () => {
    const user = await createUser();
    const song = await createSong(user.id);

    await favoritesRepository.addIfOwned(user.id, song.id);
    await favoritesRepository.addIfOwned(user.id, song.id);

    assert.equal(
      await countRows('favorites', 'user_id = $1 AND song_id = $2', [user.id, song.id]),
      1
    );
  });

  it('addIfOwned identifica la cancion ajena sin insertar', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const song = await createSong(owner.id);

    const result = await favoritesRepository.addIfOwned(intruder.id, song.id);

    assert.deepEqual(result, { songExists: true, songOwnerId: owner.id });
    assert.equal(
      await countRows('favorites', 'user_id = $1 AND song_id = $2', [intruder.id, song.id]),
      0
    );
  });

  it('addIfOwned distingue una cancion inexistente', async () => {
    const user = await createUser();

    const result = await favoritesRepository.addIfOwned(user.id, crypto.randomUUID());

    assert.deepEqual(result, { songExists: false, songOwnerId: null });
  });

  it('addSongIfOwned inserta una cancion propia en una playlist propia', async () => {
    const user = await createUser();
    const song = await createSong(user.id);
    const playlist = await createPlaylist(user.id);

    const result = await playlistsRepository.addSongIfOwned(user.id, playlist.id, song.id);

    assert.deepEqual(result, {
      playlistExists: true,
      songExists: true,
      songOwnerId: user.id,
    });
    assert.equal(
      await countRows('playlist_songs', 'playlist_id = $1 AND song_id = $2', [
        playlist.id,
        song.id,
      ]),
      1
    );
  });

  it('addSongIfOwned conserva el comportamiento de duplicado', async () => {
    const user = await createUser();
    const song = await createSong(user.id);
    const playlist = await createPlaylist(user.id);

    await playlistsRepository.addSongIfOwned(user.id, playlist.id, song.id);
    await playlistsRepository.addSongIfOwned(user.id, playlist.id, song.id);

    assert.equal(
      await countRows('playlist_songs', 'playlist_id = $1 AND song_id = $2', [
        playlist.id,
        song.id,
      ]),
      1
    );
  });

  it('addSongIfOwned no revela una playlist ajena', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const playlist = await createPlaylist(owner.id);
    const song = await createSong(intruder.id);

    const result = await playlistsRepository.addSongIfOwned(
      intruder.id,
      playlist.id,
      song.id
    );

    assert.deepEqual(result, {
      playlistExists: false,
      songExists: true,
      songOwnerId: intruder.id,
    });
    assert.equal(
      await countRows('playlist_songs', 'playlist_id = $1 AND song_id = $2', [
        playlist.id,
        song.id,
      ]),
      0
    );
  });

  it('addSongIfOwned identifica la cancion ajena sin insertar', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const playlist = await createPlaylist(intruder.id);
    const foreignSong = await createSong(owner.id);

    const result = await playlistsRepository.addSongIfOwned(
      intruder.id,
      playlist.id,
      foreignSong.id
    );

    assert.deepEqual(result, {
      playlistExists: true,
      songExists: true,
      songOwnerId: owner.id,
    });
    assert.equal(
      await countRows('playlist_songs', 'playlist_id = $1 AND song_id = $2', [
        playlist.id,
        foreignSong.id,
      ]),
      0
    );
  });

  it('addSongIfOwned distingue playlist y cancion inexistentes', async () => {
    const user = await createUser();
    const song = await createSong(user.id);
    const playlist = await createPlaylist(user.id);

    const missingPlaylist = await playlistsRepository.addSongIfOwned(
      user.id,
      crypto.randomUUID(),
      song.id
    );
    assert.deepEqual(missingPlaylist, {
      playlistExists: false,
      songExists: true,
      songOwnerId: user.id,
    });

    const missingSong = await playlistsRepository.addSongIfOwned(
      user.id,
      playlist.id,
      crypto.randomUUID()
    );
    assert.deepEqual(missingSong, {
      playlistExists: true,
      songExists: false,
      songOwnerId: null,
    });
  });

  it('FOR KEY SHARE bloquea el borrado concurrente de la cancion', async () => {
    const user = await createUser();
    const song = await createSong(user.id);
    const first = await pool.connect();
    const second = await pool.connect();

    try {
      await first.query('BEGIN');
      // Misma forma que `favoritesRepository.addIfOwned`: mantiene el lock
      // mientras la transaccion esta abierta.
      await first.query(
        `WITH target_song AS (
           SELECT id, user_id FROM songs WHERE id = $2 FOR KEY SHARE
         ), inserted AS (
           INSERT INTO favorites (user_id, song_id)
           SELECT $1, id FROM target_song WHERE user_id = $1
           ON CONFLICT DO NOTHING
           RETURNING 1
         )
         SELECT EXISTS (SELECT 1 FROM target_song) AS song_exists`,
        [user.id, song.id]
      );

      await second.query("SET statement_timeout = '300ms'");
      await assert.rejects(
        () => second.query('DELETE FROM songs WHERE id = $1', [song.id]),
        (error: unknown) => (error as { code?: string }).code === '57014'
      );
    } finally {
      await first.query('ROLLBACK').catch(() => undefined);
      first.release();
      await second.query('SET statement_timeout = 0').catch(() => undefined);
      await second.query('ROLLBACK').catch(() => undefined);
      second.release();
    }
  });
});
