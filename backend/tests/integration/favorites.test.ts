import '../helpers/env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { createApp } from '../../src/app';
import { integrationEnabled } from '../helpers/env';
import {
  closeDatabase,
  countRows,
  createSong,
  createUser,
  prepareDatabase,
} from '../helpers/db';
import { requestJson } from '../helpers/api';
import { startTestServer, type TestServer } from '../helpers/server';

interface SongView {
  id: string;
  title: string;
  user_id: string;
}

describe('favoritos y propiedad de canciones (PostgreSQL real)', { skip: !integrationEnabled }, () => {
  let server: TestServer;

  before(async () => {
    await prepareDatabase();
    server = await startTestServer(createApp());
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  it('permite agregar una cancion propia', async () => {
    const user = await createUser();
    const song = await createSong(user.id);

    const result = await requestJson(server.baseUrl, `/api/favorites/${song.id}`, {
      method: 'POST',
      token: user.token,
    });

    assert.equal(result.status, 201);
    assert.equal(
      await countRows('favorites', 'user_id = $1 AND song_id = $2', [user.id, song.id]),
      1
    );
  });

  it('rechaza con 403 una cancion ajena y no crea el favorito', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const foreignSong = await createSong(owner.id);

    const result = await requestJson(
      server.baseUrl,
      `/api/favorites/${foreignSong.id}`,
      { method: 'POST', token: intruder.token }
    );

    assert.equal(result.status, 403);
    assert.equal(
      await countRows('favorites', 'user_id = $1 AND song_id = $2', [
        intruder.id,
        foreignSong.id,
      ]),
      0
    );
  });

  it('responde 404 cuando la cancion no existe', async () => {
    const user = await createUser();

    const result = await requestJson(
      server.baseUrl,
      `/api/favorites/${crypto.randomUUID()}`,
      { method: 'POST', token: user.token }
    );

    assert.equal(result.status, 404);
  });

  it('mantiene el comportamiento de favorito duplicado', async () => {
    const user = await createUser();
    const song = await createSong(user.id);

    const first = await requestJson(server.baseUrl, `/api/favorites/${song.id}`, {
      method: 'POST',
      token: user.token,
    });
    const second = await requestJson(server.baseUrl, `/api/favorites/${song.id}`, {
      method: 'POST',
      token: user.token,
    });

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(
      await countRows('favorites', 'user_id = $1 AND song_id = $2', [user.id, song.id]),
      1
    );
  });

  it('elimina un favorito propio', async () => {
    const user = await createUser();
    const song = await createSong(user.id);
    await requestJson(server.baseUrl, `/api/favorites/${song.id}`, {
      method: 'POST',
      token: user.token,
    });

    const result = await requestJson(server.baseUrl, `/api/favorites/${song.id}`, {
      method: 'DELETE',
      token: user.token,
    });

    assert.equal(result.status, 200);
    assert.equal(
      await countRows('favorites', 'user_id = $1 AND song_id = $2', [user.id, song.id]),
      0
    );
  });

  it('no expone los favoritos de otro usuario', async () => {
    const first = await createUser();
    const second = await createUser();
    const firstSong = await createSong(first.id);
    const secondSong = await createSong(second.id);

    await requestJson(server.baseUrl, `/api/favorites/${firstSong.id}`, {
      method: 'POST',
      token: first.token,
    });
    await requestJson(server.baseUrl, `/api/favorites/${secondSong.id}`, {
      method: 'POST',
      token: second.token,
    });

    const result = await requestJson<{ songs: SongView[] }>(
      server.baseUrl,
      '/api/favorites',
      { token: first.token }
    );

    assert.equal(result.status, 200);
    assert.deepEqual(
      result.body.songs.map((song) => song.id),
      [firstSong.id]
    );
  });

  it('comprueba solo los favoritos del usuario autenticado', async () => {
    const first = await createUser();
    const second = await createUser();
    const firstSong = await createSong(first.id);
    const secondSong = await createSong(second.id);

    await requestJson(server.baseUrl, `/api/favorites/${firstSong.id}`, {
      method: 'POST',
      token: first.token,
    });

    const own = await requestJson<{ isFavorite: boolean }>(
      server.baseUrl,
      `/api/favorites/check/${firstSong.id}`,
      { token: first.token }
    );
    const foreign = await requestJson<{ isFavorite: boolean }>(
      server.baseUrl,
      `/api/favorites/check/${secondSong.id}`,
      { token: first.token }
    );

    assert.equal(own.body.isFavorite, true);
    assert.equal(foreign.body.isFavorite, false);
  });

  it('ignora un user_id del body y usa el usuario autenticado', async () => {
    const owner = await createUser();
    const other = await createUser();
    const song = await createSong(owner.id);

    const result = await requestJson(server.baseUrl, `/api/favorites/${song.id}`, {
      method: 'POST',
      token: owner.token,
      body: { user_id: other.id },
    });

    assert.equal(result.status, 201);
    assert.equal(
      await countRows('favorites', 'user_id = $1 AND song_id = $2', [owner.id, song.id]),
      1
    );
    assert.equal(
      await countRows('favorites', 'user_id = $1 AND song_id = $2', [other.id, song.id]),
      0
    );
  });
});
