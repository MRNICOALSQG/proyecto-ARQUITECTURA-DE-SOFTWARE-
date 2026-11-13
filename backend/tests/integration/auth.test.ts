import '../helpers/env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app';
import { integrationSkipReason } from '../helpers/env';
import { closeDatabase, prepareDatabase } from '../helpers/db';
import { requestJson } from '../helpers/api';
import { startTestServer, type TestServer } from '../helpers/server';

interface AuthBody {
  user: {
    id: string;
    email: string;
    username: string;
    avatar_url: string | null;
    password_hash?: string;
  };
  token: string;
}

describe('autenticacion (PostgreSQL real)', { skip: integrationSkipReason() }, () => {
  let server: TestServer;

  before(async () => {
    await prepareDatabase();
    server = await startTestServer(createApp());
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  async function register(email: string, password = 'password123'): Promise<AuthBody> {
    const result = await requestJson<AuthBody>(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { email, password, username: 'Test User' },
    });
    assert.equal(result.status, 201);
    return result.body;
  }

  it('registra un usuario valido sin exponer el hash', async () => {
    const email = `register-${crypto.randomUUID()}@example.test`;
    const result = await requestJson<AuthBody>(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { email, password: 'password123', username: '<New User>' },
    });

    assert.equal(result.status, 201);
    assert.equal(result.body.user.email, email);
    assert.equal(result.body.user.username, 'New User');
    assert.equal(result.body.user.password_hash, undefined);
    assert.equal(typeof result.body.token, 'string');
  });

  it('inicia sesion con credenciales validas', async () => {
    const email = `login-${crypto.randomUUID()}@example.test`;
    await register(email, 'correct-password');

    const result = await requestJson<AuthBody>(server.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email, password: 'correct-password' },
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.user.email, email);
    assert.equal(typeof result.body.token, 'string');
  });

  it('rechaza credenciales incorrectas con 401', async () => {
    const email = `wrong-${crypto.randomUUID()}@example.test`;
    await register(email, 'correct-password');

    const wrongPassword = await requestJson(server.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email, password: 'wrong-password' },
    });
    assert.equal(wrongPassword.status, 401);

    const unknownUser = await requestJson(server.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: `unknown-${crypto.randomUUID()}@example.test`, password: 'whatever' },
    });
    assert.equal(unknownUser.status, 401);
  });

  it('rechaza un registro duplicado con 409', async () => {
    const email = `duplicate-${crypto.randomUUID()}@example.test`;
    await register(email);

    const duplicate = await requestJson(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { email, password: 'password123' },
    });

    assert.equal(duplicate.status, 409);
  });

  it('exige token en rutas protegidas', async () => {
    const withoutToken = await requestJson(server.baseUrl, '/api/auth/me');
    assert.equal(withoutToken.status, 401);
  });

  it('rechaza un token invalido o expirado', async () => {
    const invalid = await requestJson(server.baseUrl, '/api/auth/me', {
      token: 'not-a-valid-jwt',
    });
    assert.equal(invalid.status, 401);

    const user = await register(`expired-${crypto.randomUUID()}@example.test`);
    const expired = jwt.sign(
      { sub: user.user.id, jti: crypto.randomUUID() },
      process.env.JWT_SECRET as string,
      { expiresIn: '-1s', algorithm: 'HS256' }
    );

    const expiredResult = await requestJson(server.baseUrl, '/api/auth/me', {
      token: expired,
    });
    assert.equal(expiredResult.status, 401);
  });

  it('devuelve el usuario autenticado en /me', async () => {
    const user = await register(`me-${crypto.randomUUID()}@example.test`);

    const result = await requestJson<{ user: AuthBody['user'] }>(
      server.baseUrl,
      '/api/auth/me',
      { token: user.token }
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.user.id, user.user.id);
    assert.equal(result.body.user.email, user.user.email);
    assert.equal(result.body.user.password_hash, undefined);
  });

  it('revoca el token al cerrar sesion', async () => {
    const user = await register(`logout-${crypto.randomUUID()}@example.test`);

    const logout = await requestJson(server.baseUrl, '/api/auth/logout', {
      method: 'POST',
      token: user.token,
    });
    assert.equal(logout.status, 200);

    const me = await requestJson(server.baseUrl, '/api/auth/me', {
      token: user.token,
    });
    assert.equal(me.status, 401);
  });
});
