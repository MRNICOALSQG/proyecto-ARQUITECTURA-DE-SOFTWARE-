import '../helpers/env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app';
import { integrationSkipReason } from '../helpers/env';
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
  user_id: string;
  title: string;
  artist: string;
  cover_path: string | null;
}

interface SongResponse {
  song: SongView;
}

interface SongListResponse {
  songs: SongView[];
}

describe('canciones (PostgreSQL real)', { skip: integrationSkipReason() }, () => {
  let server: TestServer;

  before(async () => {
    await prepareDatabase();
    server = await startTestServer(createApp());
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  it('lista solo las canciones del usuario autenticado', async () => {
    const owner = await createUser();
    const other = await createUser();
    const own = await createSong(owner.id, { title: 'Own Song' });
    await createSong(other.id, { title: 'Other Song' });

    const result = await requestJson<SongListResponse>(server.baseUrl, '/api/songs', {
      token: owner.token,
    });

    assert.equal(result.status, 200);
    assert.deepEqual(
      result.body.songs.map((song) => song.id),
      [own.id]
    );
  });

  it('filtra por titulo con el parametro search', async () => {
    const user = await createUser();
    const match = await createSong(user.id, { title: 'Unique Anthem' });
    await createSong(user.id, { title: 'Different Track' });

    const result = await requestJson<SongListResponse>(
      server.baseUrl,
      '/api/songs?search=unique',
      { token: user.token }
    );

    assert.equal(result.status, 200);
    assert.deepEqual(
      result.body.songs.map((song) => song.id),
      [match.id]
    );
  });

  it('actualiza el titulo y la portada de una cancion propia', async () => {
    const user = await createUser();
    const song = await createSong(user.id, { title: 'Original' });

    const result = await requestJson<SongResponse>(server.baseUrl, `/api/songs/${song.id}`, {
      method: 'PUT',
      token: user.token,
      body: {
        title: '<New Title>',
        cover_path: '/uploads/images/cover.png',
      },
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.song.title, 'New Title');
    assert.equal(result.body.song.cover_path, '/uploads/images/cover.png');
  });

  it('rechaza una portada fuera de /uploads/images', async () => {
    const user = await createUser();
    const song = await createSong(user.id);

    const result = await requestJson(server.baseUrl, `/api/songs/${song.id}`, {
      method: 'PUT',
      token: user.token,
      body: { title: 'Valid Title', cover_path: '/etc/passwd' },
    });

    assert.equal(result.status, 400);
  });

  it('no permite actualizar una cancion ajena', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const song = await createSong(owner.id, { title: 'Private Song' });

    const result = await requestJson(server.baseUrl, `/api/songs/${song.id}`, {
      method: 'PUT',
      token: intruder.token,
      body: { title: 'Hijacked' },
    });

    assert.equal(result.status, 404);
    assert.equal(
      await countRows('songs', 'id = $1 AND title = $2', [song.id, 'Private Song']),
      1
    );
  });

  it('elimina una cancion propia', async () => {
    const user = await createUser();
    const song = await createSong(user.id);

    const result = await requestJson(server.baseUrl, `/api/songs/${song.id}`, {
      method: 'DELETE',
      token: user.token,
    });

    assert.equal(result.status, 200);
    assert.equal(await countRows('songs', 'id = $1', [song.id]), 0);
  });

  it('no permite eliminar una cancion ajena', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const song = await createSong(owner.id);

    const result = await requestJson(server.baseUrl, `/api/songs/${song.id}`, {
      method: 'DELETE',
      token: intruder.token,
    });

    assert.equal(result.status, 404);
    assert.equal(await countRows('songs', 'id = $1', [song.id]), 1);
  });

  it('exige token para listar canciones', async () => {
    const result = await requestJson(server.baseUrl, '/api/songs');
    assert.equal(result.status, 401);
  });
});
