import '../helpers/env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app';
import { integrationSkipReason } from '../helpers/env';
import { closeDatabase, createUser, prepareDatabase } from '../helpers/db';
import { requestJson } from '../helpers/api';
import { startTestServer, type TestServer } from '../helpers/server';

interface ProfileView {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  password_hash?: string;
}

interface ProfileResponse {
  user: ProfileView;
}

describe('perfil (PostgreSQL real)', { skip: integrationSkipReason() }, () => {
  let server: TestServer;

  before(async () => {
    await prepareDatabase();
    server = await startTestServer(createApp());
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  it('actualiza el username y el avatar del usuario autenticado', async () => {
    const user = await createUser();

    const result = await requestJson<ProfileResponse>(
      server.baseUrl,
      '/api/auth/profile',
      {
        method: 'PUT',
        token: user.token,
        body: {
          username: '<New Name>',
          avatar_url: '/uploads/images/avatar.png',
        },
      }
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.user.id, user.id);
    assert.equal(result.body.user.username, 'New Name');
    assert.equal(result.body.user.avatar_url, '/uploads/images/avatar.png');
    assert.equal(result.body.user.password_hash, undefined);
  });

  it('refleja el cambio en /me', async () => {
    const user = await createUser();

    await requestJson(server.baseUrl, '/api/auth/profile', {
      method: 'PUT',
      token: user.token,
      body: { username: 'Updated User' },
    });

    const me = await requestJson<ProfileResponse>(server.baseUrl, '/api/auth/me', {
      token: user.token,
    });

    assert.equal(me.status, 200);
    assert.equal(me.body.user.username, 'Updated User');
  });

  it('ignora identificadores ajenos enviados en el body', async () => {
    const owner = await createUser();
    const other = await createUser();

    const result = await requestJson<ProfileResponse>(
      server.baseUrl,
      '/api/auth/profile',
      {
        method: 'PUT',
        token: owner.token,
        body: {
          username: 'Owner Updated',
          id: other.id,
          user_id: other.id,
          email: 'attacker@example.test',
        },
      }
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.user.id, owner.id);
    assert.equal(result.body.user.email, owner.email);

    const otherProfile = await requestJson<ProfileResponse>(
      server.baseUrl,
      '/api/auth/me',
      { token: other.token }
    );
    assert.equal(otherProfile.body.user.username, 'Test User');
  });

  it('rechaza un username vacio', async () => {
    const user = await createUser();

    const result = await requestJson(server.baseUrl, '/api/auth/profile', {
      method: 'PUT',
      token: user.token,
      body: { username: '   ' },
    });

    assert.equal(result.status, 400);
  });

  it('exige token para actualizar el perfil', async () => {
    const result = await requestJson(server.baseUrl, '/api/auth/profile', {
      method: 'PUT',
      body: { username: 'No Token' },
    });

    assert.equal(result.status, 401);
  });
});
