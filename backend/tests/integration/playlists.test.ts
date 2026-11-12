import '../helpers/env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { createApp } from '../../src/app';
import { integrationEnabled } from '../helpers/env';
import { closeDatabase, createPlaylist, createSong, createUser, prepareDatabase } from '../helpers/db';
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

describe('playlists (PostgreSQL real)', { skip: !integrationEnabled }, () => {
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
});
