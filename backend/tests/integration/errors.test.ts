import '../helpers/env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app';
import { pool } from '../../src/config/database';
import { integrationSkipReason } from '../helpers/env';
import { closeDatabase, createUser, prepareDatabase } from '../helpers/db';
import { requestJson } from '../helpers/api';
import { startTestServer, type TestServer } from '../helpers/server';

describe('manejo de errores (PostgreSQL real)', { skip: integrationSkipReason() }, () => {
  let server: TestServer;

  before(async () => {
    await prepareDatabase();
    server = await startTestServer(createApp());
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  it('responde 400 ante un body que no cumple Zod', async () => {
    const result = await requestJson<{ error: string }>(
      server.baseUrl,
      '/api/auth/register',
      {
        method: 'POST',
        body: { email: 'no-es-email', password: 'corta' },
      }
    );

    assert.equal(result.status, 400);
    assert.equal(typeof result.body.error, 'string');
  });

  it('responde 400 ante JSON malformado', async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"email":',
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'JSON inválido' });
  });

  it('responde 413 ante un payload demasiado grande', async () => {
    const response = await fetch(`${server.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'large@example.test',
        password: 'x'.repeat(200_000),
      }),
    });

    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), {
      error: 'El cuerpo de la solicitud es demasiado grande',
    });
  });

  it('responde 400 ante un UUID invalido sin registrar el error', async () => {
    const user = await createUser();
    const originalConsoleError = console.error;
    const logs: string[] = [];
    console.error = (...args: unknown[]) => {
      logs.push(args.map((value) => String(value)).join(' '));
    };

    try {
      const result = await requestJson<{ error: string }>(
        server.baseUrl,
        '/api/favorites/check/not-a-uuid',
        { token: user.token }
      );

      assert.equal(result.status, 400);
      assert.equal(result.body.error, 'Identificador de canción inválido');
      assert.equal(logs.length, 0);
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('responde 500 generico y registra una linea JSON sin el JWT', async () => {
    const user = await createUser();
    const originalConsoleError = console.error;
    const logs: string[] = [];
    console.error = (...args: unknown[]) => {
      logs.push(args.map((value) => String(value)).join(' '));
    };

    try {
      await pool.query('ALTER TABLE songs RENAME TO songs_hidden_for_error_test');
      try {
        const response = await fetch(
          `${server.baseUrl}/api/songs?token=${encodeURIComponent(user.token)}`,
          { headers: {} }
        );

        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), {
          error: 'Error interno del servidor',
        });
      } finally {
        await pool.query('ALTER TABLE songs_hidden_for_error_test RENAME TO songs');
      }

      assert.equal(logs.length, 1);
      assert.equal(logs[0].includes('\n'), false);

      const record = JSON.parse(logs[0]);
      assert.equal(record.level, 'error');
      assert.equal(record.status, 500);
      assert.equal(record.method, 'GET');
      assert.equal(record.path, '/api/songs');
      assert.equal(logs[0].includes(user.token), false);
    } finally {
      console.error = originalConsoleError;
    }
  });
});
