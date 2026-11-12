import { uploadDirPath } from '../helpers/env';
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  deleteUploadIfExists,
  isUploadPublicPath,
  resolveUploadPath,
} from '../../src/shared/uploads';

describe('rutas de uploads', () => {
  const createdPaths: string[] = [];

  afterEach(() => {
    for (const createdPath of createdPaths.splice(0)) {
      fs.rmSync(createdPath, { recursive: true, force: true });
    }
  });

  it('acepta rutas publicas canonicas y rechaza escapes', () => {
    assert.equal(isUploadPublicPath('/uploads/images/cover.png'), true);
    assert.equal(isUploadPublicPath('/uploads/images/cover.png', 'images'), true);
    assert.equal(isUploadPublicPath('/uploads/songs/song.mp3', 'images'), false);
    assert.equal(isUploadPublicPath('/etc/passwd'), false);
    assert.equal(isUploadPublicPath('/uploads/../secret.txt'), false);
    assert.equal(isUploadPublicPath('/uploads/./secret.txt'), false);
    assert.equal(isUploadPublicPath('/uploads//secret.txt'), false);
    assert.equal(isUploadPublicPath('/uploads\\images\\cover.png'), false);
    assert.equal(isUploadPublicPath('/uploads/images/cover\0.png'), false);
    assert.equal(isUploadPublicPath('/uploads/C:/secret.txt'), false);
  });

  it('resuelve una ruta publica dentro de UPLOAD_DIR', () => {
    const resolved = resolveUploadPath('/uploads/images/cover.png');
    assert.equal(path.isAbsolute(resolved), true);
    assert.equal(path.relative(uploadDirPath, resolved).startsWith('..'), false);
    assert.throws(() => resolveUploadPath('/uploads/../secret.txt'));
  });

  it('elimina solo archivos dentro de UPLOAD_DIR', async () => {
    const directory = path.join(uploadDirPath, 'songs');
    const filePath = path.join(directory, 'delete-me.txt');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(filePath, 'data');
    createdPaths.push(directory);

    assert.equal(await deleteUploadIfExists('/uploads/songs/delete-me.txt'), true);
    assert.equal(fs.existsSync(filePath), false);
    assert.equal(await deleteUploadIfExists('/uploads/songs/delete-me.txt'), false);
    assert.equal(await deleteUploadIfExists(undefined), false);
    assert.equal(await deleteUploadIfExists('../outside.txt'), false);
  });
});
