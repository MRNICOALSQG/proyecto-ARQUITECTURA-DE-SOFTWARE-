import { cleanupUploadDir, integrationEnabled } from '../helpers/env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const blockedUploadPath = path.join(
  os.tmpdir(),
  `rinne-blocked-upload-${process.pid}-${Date.now()}`
);

if (integrationEnabled) {
  fs.writeFileSync(blockedUploadPath, 'this path is a file, not a directory');
  process.env.UPLOAD_DIR = blockedUploadPath;
}

const { createApp } = require('../../src/app') as typeof import('../../src/app');
const { closeDatabase, createUser, prepareDatabase } = require(
  '../helpers/db'
) as typeof import('../helpers/db');
const { startTestServer } = require('../helpers/server') as typeof import('../helpers/server');

describe(
  'uploads con error de disco (PostgreSQL real)',
  { skip: !integrationEnabled },
  () => {
    let server: import('../helpers/server').TestServer;

    before(async () => {
      await prepareDatabase();
      server = await startTestServer(createApp());
    });

    after(async () => {
      await server.close();
      await closeDatabase();
      fs.rmSync(blockedUploadPath, { force: true });
      cleanupUploadDir();
    });

    it('responde 500 generico cuando no puede crear el directorio de destino', async () => {
      const user = await createUser();
      const form = new FormData();
      form.append(
        'image',
        new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }),
        'cover.png'
      );

      const originalConsoleError = console.error;
      const logs: string[] = [];
      console.error = (...args: unknown[]) => {
        logs.push(args.map((value) => String(value)).join(' '));
      };

      try {
        const response = await fetch(`${server.baseUrl}/api/upload/image`, {
          method: 'POST',
          headers: { authorization: `Bearer ${user.token}` },
          body: form,
        });

        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), {
          error: 'Error interno del servidor',
        });
        assert.equal(logs.length, 1);
        assert.equal(logs[0].includes('\n'), false);
        assert.equal(JSON.parse(logs[0]).status, 500);
      } finally {
        console.error = originalConsoleError;
      }
    });
  }
);
