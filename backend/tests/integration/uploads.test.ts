import { cleanupUploadDir, integrationSkipReason, uploadDirPath } from '../helpers/env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createApp } from '../../src/app';
import { closeDatabase, createUser, prepareDatabase, type TestUser } from '../helpers/db';
import { startTestServer, type TestServer } from '../helpers/server';

function multipart(field: string, filename: string, type: string, bytes: Buffer): FormData {
  const form = new FormData();
  form.append(field, new Blob([new Uint8Array(bytes)], { type }), filename);
  return form;
}

async function upload(
  server: TestServer,
  endpoint: string,
  token: string,
  form: FormData
): Promise<Response> {
  return fetch(`${server.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
}

function publicPathToDisk(publicPath: string): string {
  return path.join(uploadDirPath, ...publicPath.replace(/^\/uploads\//, '').split('/'));
}

describe('uploads (PostgreSQL real)', { skip: integrationSkipReason() }, () => {
  let server: TestServer;
  let user: TestUser;

  before(async () => {
    await prepareDatabase();
    server = await startTestServer(createApp());
    user = await createUser();
  });

  after(async () => {
    await server.close();
    await closeDatabase();
    cleanupUploadDir();
  });

  it('acepta una imagen valida y devuelve su URL publica', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const response = await upload(
      server,
      '/api/upload/image',
      user.token,
      multipart('image', 'cover.png', 'image/png', png)
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as { url: string };
    assert.match(body.url, /^\/uploads\/images\/.+\.png$/);
    assert.equal(fs.existsSync(publicPathToDisk(body.url)), true);
  });

  it('rechaza un tipo de imagen no permitido', async () => {
    const response = await upload(
      server,
      '/api/upload/image',
      user.token,
      multipart('image', 'notes.txt', 'text/plain', Buffer.from('text'))
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Formato de imagen no compatible' });
  });

  it('aplica el limite de 5 MB a las imagenes', { timeout: 120_000 }, async () => {
    const tooLarge = Buffer.alloc(5 * 1024 * 1024 + 1, 1);
    const response = await upload(
      server,
      '/api/upload/image',
      user.token,
      multipart('image', 'huge.png', 'image/png', tooLarge)
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: string };
    assert.match(body.error, /5MB/);
  });

  it('acepta un audio valido y crea la cancion del usuario', async () => {
    const response = await upload(
      server,
      '/api/songs/upload',
      user.token,
      multipart('audio', 'My <Song>.mp3', 'audio/mpeg', Buffer.from('fake-mp3'))
    );

    assert.equal(response.status, 201);
    const body = (await response.json()) as {
      songs: Array<{
        id: string;
        user_id: string;
        title: string;
        file_path: string;
        mime_type: string;
      }>;
    };
    assert.equal(body.songs.length, 1);
    assert.equal(body.songs[0].title, 'My Song');
    assert.equal(body.songs[0].user_id, user.id);
    assert.equal(body.songs[0].mime_type, 'audio/mpeg');
    assert.match(body.songs[0].file_path, /^\/uploads\/songs\/.+\.mp3$/);
    assert.equal(fs.existsSync(publicPathToDisk(body.songs[0].file_path)), true);
  });

  it('aplica el limite de 50 MB a los audios', { timeout: 120_000 }, async () => {
    const tooLarge = Buffer.alloc(50 * 1024 * 1024 + 1, 1);
    const response = await upload(
      server,
      '/api/songs/upload',
      user.token,
      multipart('audio', 'huge.mp3', 'audio/mpeg', tooLarge)
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: string };
    assert.match(body.error, /50MB/);
  });

  it('rechaza un campo de archivo inesperado', async () => {
    const response = await upload(
      server,
      '/api/upload/image',
      user.token,
      multipart('file', 'cover.png', 'image/png', Buffer.from('png'))
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Campo de archivo inesperado' });
  });
});
