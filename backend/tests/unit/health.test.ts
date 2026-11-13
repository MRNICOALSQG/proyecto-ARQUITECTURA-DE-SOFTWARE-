import '../helpers/env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, type TestServer } from '../helpers/server';
import { stubModule } from '../helpers/stub';

const databasePath = require.resolve('../../src/config/database');
const fakePool = {
  query: async () => ({ rows: [] as unknown[] }),
};
const restoreDatabase = stubModule(databasePath, {
  pool: fakePool,
  query: async () => ({ rows: [] as unknown[] }),
  testConnection: async () => undefined,
});

const { createApp } = require('../../src/app') as typeof import('../../src/app');

describe('health check sin PostgreSQL', () => {
  let server: TestServer;

  before(async () => {
    server = await startTestServer(createApp());
  });

  after(async () => {
    await server.close();
    restoreDatabase();
  });

  it('responde 200 con {status, db, version} cuando la base responde', async () => {
    fakePool.query = async () => ({ rows: [] });

    const response = await fetch(`${server.baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', db: 'ok', version: 'test' });
  });

  it('responde 503 con el mismo formato cuando la base falla', async () => {
    const originalConsoleError = console.error;
    const logs: string[] = [];
    console.error = (...args: unknown[]) => {
      logs.push(args.map((value) => String(value)).join(' '));
    };

    try {
      fakePool.query = async () => {
        throw new Error('database unavailable');
      };

      const response = await fetch(`${server.baseUrl}/api/health`);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        status: 'error',
        db: 'error',
        version: 'test',
      });
      assert.equal(logs.length, 1);
    } finally {
      console.error = originalConsoleError;
    }
  });
});
