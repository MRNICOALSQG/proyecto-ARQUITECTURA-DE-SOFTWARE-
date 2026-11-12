import '../helpers/env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app';
import { integrationEnabled } from '../helpers/env';
import { closeDatabase, prepareDatabase } from '../helpers/db';
import { startTestServer, type TestServer } from '../helpers/server';

describe('GET /api/health (PostgreSQL real)', { skip: !integrationEnabled }, () => {
  let server: TestServer;

  before(async () => {
    await prepareDatabase();
    server = await startTestServer(createApp());
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  it('responde 200 con status, db y version', async () => {
    const response = await fetch(`${server.baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'ok',
      db: 'ok',
      version: 'test',
    });
  });
});
