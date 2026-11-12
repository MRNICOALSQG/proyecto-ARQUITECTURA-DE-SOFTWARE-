import '../helpers/env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PassThrough } from 'node:stream';
import { createApp } from '../../src/app';
import { integrationEnabled, uploadDirPath } from '../helpers/env';
import { closeDatabase, createSong, createUser, prepareDatabase, type TestUser } from '../helpers/db';
import { startTestServer, type TestServer } from '../helpers/server';

const audioBytes = Buffer.from('Hello Rinne');

describe('streaming de audio (PostgreSQL real)', { skip: !integrationEnabled }, () => {
  let server: TestServer;
  let user: TestUser;
  let songId: string;

  before(async () => {
    await prepareDatabase();
    server = await startTestServer(createApp());
    user = await createUser();

    const songsDirectory = path.join(uploadDirPath, 'songs');
    fs.mkdirSync(songsDirectory, { recursive: true });
    fs.writeFileSync(path.join(songsDirectory, 'stream-test.mp3'), audioBytes);

    const song = await createSong(user.id, {
      file_path: '/uploads/songs/stream-test.mp3',
      title: 'Stream Test',
    });
    songId = song.id;
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  function streamUrl(id: string): string {
    return `${server.baseUrl}/api/songs/${id}/stream`;
  }

  it('responde 200 con el archivo completo', async () => {
    const response = await fetch(streamUrl(songId), {
      headers: { authorization: `Bearer ${user.token}` },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.equal(response.headers.get('content-length'), String(audioBytes.length));
    assert.equal(await response.text(), audioBytes.toString());
  });

  it('responde 206 con el rango solicitado', async () => {
    const response = await fetch(streamUrl(songId), {
      headers: {
        authorization: `Bearer ${user.token}`,
        range: 'bytes=0-4',
      },
    });

    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), `bytes 0-4/${audioBytes.length}`);
    assert.equal(response.headers.get('content-length'), '5');
    assert.equal(await response.text(), 'Hello');
  });

  it('responde 404 si la cancion no existe o no pertenece al usuario', async () => {
    const response = await fetch(streamUrl(crypto.randomUUID()), {
      headers: { authorization: `Bearer ${user.token}` },
    });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Canción no encontrada' });
  });

  it('responde 404 si el archivo no existe en disco', async () => {
    const missing = await createSong(user.id, {
      file_path: `/uploads/songs/missing-${crypto.randomUUID()}.mp3`,
    });

    const response = await fetch(streamUrl(missing.id), {
      headers: { authorization: `Bearer ${user.token}` },
    });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Archivo no encontrado' });
  });

  it('maneja un error posterior al envio de cabeceras sin segunda respuesta', async () => {
    const fsWithMutableStream = fs as unknown as {
      createReadStream: (...args: unknown[]) => fs.ReadStream;
    };
    const originalCreateReadStream = fsWithMutableStream.createReadStream;
    let shouldFail = false;

    fsWithMutableStream.createReadStream = (...args: unknown[]) => {
      if (!shouldFail) return originalCreateReadStream(...args);

      const stream = new PassThrough();
      process.nextTick(() => stream.emit('open', 0, null));
      setTimeout(() => stream.destroy(new Error('simulated read failure')), 25);
      return stream as unknown as fs.ReadStream;
    };

    const originalConsoleError = console.error;
    const logs: string[] = [];
    console.error = (...args: unknown[]) => {
      logs.push(args.map((value) => String(value)).join(' '));
    };

    shouldFail = true;
    let failed = false;

    try {
      try {
        const response = await fetch(streamUrl(songId), {
          headers: { authorization: `Bearer ${user.token}` },
        });
        if (response.status !== 200) {
          throw new Error(`estado inesperado: ${response.status}`);
        }
        await response.arrayBuffer();
      } catch {
        failed = true;
      }

      for (let attempt = 0; attempt < 20 && logs.length === 0; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } finally {
      shouldFail = false;
      fsWithMutableStream.createReadStream = originalCreateReadStream;
      console.error = originalConsoleError;
    }

    assert.equal(failed, true);
    assert.equal(logs.length, 1);
    const record = JSON.parse(logs[0]);
    assert.equal(record.status, 500);
    assert.equal(record.path, `/api/songs/${songId}/stream`);
    assert.equal(logs[0].includes(user.token), false);
  });
});
