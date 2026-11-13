import '../helpers/env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { createApp } from '../../src/app';
import { integrationSkipReason } from '../helpers/env';
import {
  closeDatabase,
  countRows,
  createPlaylist,
  createSong,
  createUser,
  prepareDatabase,
} from '../helpers/db';
import { requestJson } from '../helpers/api';
import { startTestServer, type TestServer } from '../helpers/server';

interface PlaylistView {
  id: string;
  user_id: string;
  name: string;
  cover_url: string | null;
}

interface PlaylistResponse {
  playlist: PlaylistView;
}

interface PlaylistListResponse {
  playlists: PlaylistView[];
}

interface PlaylistSongView {
  id: string;
  user_id: string;
  title: string;
}

interface PlaylistSongListResponse {
  songs: PlaylistSongView[];
}

describe('playlists (PostgreSQL real)', { skip: integrationSkipReason() }, () => {
  let server: TestServer;

  before(async () => {
    await prepareDatabase();
    server = await startTestServer(createApp());
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  it('crea una playlist propia saneando el nombre', async () => {
    const user = await createUser();

    const result = await requestJson<PlaylistResponse>(server.baseUrl, '/api/playlists', {
      method: 'POST',
      token: user.token,
      body: { name: '<My List>' },
    });

    assert.equal(result.status, 201);
    assert.equal(result.body.playlist.name, 'My List');
    assert.equal(result.body.playlist.user_id, user.id);
  });

  it('lista solo las playlists del usuario autenticado', async () => {
    const owner = await createUser();
    const other = await createUser();
    await createPlaylist(owner.id, 'Owner List');
    await createPlaylist(other.id, 'Other List');

    const result = await requestJson<PlaylistListResponse>(
      server.baseUrl,
      '/api/playlists',
      { token: owner.token }
    );

    assert.equal(result.status, 200);
    assert.deepEqual(
      result.body.playlists.map((playlist) => playlist.name),
      ['Owner List']
    );
  });

  it('actualiza una playlist propia y conserva la portada si se omite', async () => {
    const user = await createUser();
    const playlist = await createPlaylist(user.id, 'Original');

    const updated = await requestJson<PlaylistResponse>(
      server.baseUrl,
      `/api/playlists/${playlist.id}`,
      {
        method: 'PUT',
        token: user.token,
        body: { name: 'Renamed', cover_url: '/uploads/images/cover.png' },
      }
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.playlist.name, 'Renamed');
    assert.equal(updated.body.playlist.cover_url, '/uploads/images/cover.png');

    const withoutCover = await requestJson<PlaylistResponse>(
      server.baseUrl,
      `/api/playlists/${playlist.id}`,
      { method: 'PUT', token: user.token, body: { name: 'Renamed Again' } }
    );
    assert.equal(withoutCover.status, 200);
    assert.equal(withoutCover.body.playlist.cover_url, '/uploads/images/cover.png');
  });

  it('elimina una playlist propia', async () => {
    const user = await createUser();
    const playlist = await createPlaylist(user.id, 'Delete Me');

    const deleted = await requestJson(server.baseUrl, `/api/playlists/${playlist.id}`, {
      method: 'DELETE',
      token: user.token,
    });
    assert.equal(deleted.status, 200);

    const list = await requestJson<PlaylistListResponse>(
      server.baseUrl,
      '/api/playlists',
      { token: user.token }
    );
    assert.deepEqual(list.body.playlists, []);
  });

  it('responde 404 para una playlist inexistente', async () => {
    const user = await createUser();
    const missing = crypto.randomUUID();

    for (const [method, path] of [
      ['PUT', `/api/playlists/${missing}`],
      ['DELETE', `/api/playlists/${missing}`],
      ['GET', `/api/playlists/${missing}/songs`],
    ] as const) {
      const result = await requestJson(server.baseUrl, path, {
        method,
        token: user.token,
        body: method === 'PUT' ? { name: 'X' } : undefined,
      });
      assert.equal(result.status, 404, `${method} ${path}`);
    }
  });

  it('no permite leer ni modificar una playlist ajena', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const playlist = await createPlaylist(owner.id, 'Private');
    const song = await createSong(intruder.id);

    const attempts = [
      { method: 'GET', path: `/api/playlists/${playlist.id}/songs` },
      { method: 'PUT', path: `/api/playlists/${playlist.id}`, body: { name: 'Hijacked' } },
      { method: 'DELETE', path: `/api/playlists/${playlist.id}` },
      {
        method: 'POST',
        path: `/api/playlists/${playlist.id}/songs`,
        body: { song_id: song.id },
      },
      {
        method: 'DELETE',
        path: `/api/playlists/${playlist.id}/songs/${song.id}`,
      },
    ] as const;

    for (const attempt of attempts) {
      const result = await requestJson(server.baseUrl, attempt.path, {
        method: attempt.method,
        token: intruder.token,
        body: 'body' in attempt ? attempt.body : undefined,
      });
      assert.equal(result.status, 404, `${attempt.method} ${attempt.path}`);
    }
  });

  it('ignora un user_id del body y usa el usuario autenticado', async () => {
    const owner = await createUser();
    const other = await createUser();

    const created = await requestJson<PlaylistResponse>(server.baseUrl, '/api/playlists', {
      method: 'POST',
      token: owner.token,
      body: { name: 'Spoof Attempt', user_id: other.id },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.playlist.user_id, owner.id);

    const otherList = await requestJson<PlaylistListResponse>(
      server.baseUrl,
      '/api/playlists',
      { token: other.token }
    );
    assert.deepEqual(otherList.body.playlists, []);
  });

  it('agrega una cancion propia a una playlist (camino feliz)', async () => {
    const user = await createUser();
    const playlist = await createPlaylist(user.id, 'Favorites Mix');
    const song = await createSong(user.id, { title: 'Added Song' });

    const added = await requestJson<{ success: boolean }>(
      server.baseUrl,
      `/api/playlists/${playlist.id}/songs`,
      { method: 'POST', token: user.token, body: { song_id: song.id } }
    );

    assert.equal(added.status, 201);
    assert.equal(added.body.success, true);
    assert.equal(
      await countRows('playlist_songs', 'playlist_id = $1 AND song_id = $2', [
        playlist.id,
        song.id,
      ]),
      1
    );

    const listed = await requestJson<PlaylistSongListResponse>(
      server.baseUrl,
      `/api/playlists/${playlist.id}/songs`,
      { token: user.token }
    );

    assert.equal(listed.status, 200);
    assert.deepEqual(
      listed.body.songs.map((item) => item.id),
      [song.id]
    );
    assert.equal(listed.body.songs[0].title, 'Added Song');
  });

  it('es idempotente al agregar dos veces la misma cancion', async () => {
    const user = await createUser();
    const playlist = await createPlaylist(user.id, 'No Duplicates');
    const song = await createSong(user.id);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await requestJson(server.baseUrl, `/api/playlists/${playlist.id}/songs`, {
        method: 'POST',
        token: user.token,
        body: { song_id: song.id },
      });
      assert.equal(result.status, 201, `intento ${attempt + 1}`);
    }

    assert.equal(
      await countRows('playlist_songs', 'playlist_id = $1 AND song_id = $2', [
        playlist.id,
        song.id,
      ]),
      1
    );
  });

  it('quita una cancion de la playlist sin borrar la cancion', async () => {
    const user = await createUser();
    const playlist = await createPlaylist(user.id, 'Remove Song');
    const song = await createSong(user.id);

    await requestJson(server.baseUrl, `/api/playlists/${playlist.id}/songs`, {
      method: 'POST',
      token: user.token,
      body: { song_id: song.id },
    });

    const removed = await requestJson<{ success: boolean }>(
      server.baseUrl,
      `/api/playlists/${playlist.id}/songs/${song.id}`,
      { method: 'DELETE', token: user.token }
    );

    assert.equal(removed.status, 200);
    assert.equal(removed.body.success, true);
    assert.equal(
      await countRows('playlist_songs', 'playlist_id = $1 AND song_id = $2', [
        playlist.id,
        song.id,
      ]),
      0
    );
    assert.equal(await countRows('songs', 'id = $1', [song.id]), 1);
  });

  it('rechaza con 403 agregar una cancion de otro usuario', async () => {
    const owner = await createUser();
    const other = await createUser();
    const playlist = await createPlaylist(owner.id, 'Owner Only');
    const foreignSong = await createSong(other.id);

    const result = await requestJson(server.baseUrl, `/api/playlists/${playlist.id}/songs`, {
      method: 'POST',
      token: owner.token,
      body: { song_id: foreignSong.id },
    });

    assert.equal(result.status, 403);
    assert.equal(
      await countRows('playlist_songs', 'playlist_id = $1 AND song_id = $2', [
        playlist.id,
        foreignSong.id,
      ]),
      0
    );
  });

  it('responde 404 al agregar una cancion inexistente', async () => {
    const user = await createUser();
    const playlist = await createPlaylist(user.id, 'Missing Song');

    const result = await requestJson(server.baseUrl, `/api/playlists/${playlist.id}/songs`, {
      method: 'POST',
      token: user.token,
      body: { song_id: crypto.randomUUID() },
    });

    assert.equal(result.status, 404);
  });
});
