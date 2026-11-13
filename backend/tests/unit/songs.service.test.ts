import { uploadDirPath } from '../helpers/env';
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { HttpError, NoEncontrado } from '../../src/shared/http-error';
import * as songsService from '../../src/modules/songs/songs.service';

type SongsRepository = typeof import('../../src/modules/songs/songs.repository');

const repository = require('../../src/modules/songs/songs.repository') as SongsRepository;
const originalRepository = { ...repository };

function errorStatus(error: unknown): number | undefined {
  return error instanceof HttpError ? error.status : undefined;
}

function song(overrides: Record<string, unknown> = {}) {
  return {
    id: 'song-1',
    user_id: 'user-a',
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    duration_seconds: 0,
    file_path: '/uploads/songs/file.mp3',
    file_size: 0,
    mime_type: 'audio/mpeg',
    cover_path: null,
    uploaded_at: '',
    ...overrides,
  } as never;
}

describe('songs.service', () => {
  afterEach(() => {
    Object.assign(repository, originalRepository);
  });

  it('responde 404 cuando la cancion no pertenece al usuario', async () => {
    repository.findByIdAndUser = async () => undefined;

    await assert.rejects(
      () => songsService.getOwnedSong('user-a', 'missing'),
      (error) => error instanceof NoEncontrado && error.status === 404
    );
  });

  it('valida el titulo y la portada antes de actualizar', async () => {
    await assert.rejects(
      () => songsService.updateSong('user-a', 'song-1', {}),
      (error) => errorStatus(error) === 400
    );

    await assert.rejects(
      () =>
        songsService.updateSong('user-a', 'song-1', {
          title: 'Valid',
          coverPath: '/etc/passwd',
        }),
      (error) => errorStatus(error) === 400
    );
  });

  it('responde 404 si la cancion desaparecio durante la actualizacion', async () => {
    repository.updateTitleAndCover = async () => undefined;

    await assert.rejects(
      () => songsService.updateSong('user-a', 'missing', { title: 'Valid' }),
      (error) => error instanceof NoEncontrado
    );
  });

  it('sanea el titulo y persiste la portada valida', async () => {
    let received: unknown[] = [];
    repository.updateTitleAndCover = async (...args: unknown[]) => {
      received = args;
      return song({ title: 'New Title' });
    };

    const updated = await songsService.updateSong('user-a', 'song-1', {
      title: '<New Title>',
      coverPath: '/uploads/images/cover.png',
    });

    assert.equal(updated.title, 'New Title');
    assert.deepEqual(received, ['song-1', 'user-a', 'New Title', '/uploads/images/cover.png']);
  });

  it('crea canciones desde uploads con titulo saneado y valores por defecto', async () => {
    const inserted: Record<string, unknown>[] = [];
    repository.insert = async (input) => {
      inserted.push(input as unknown as Record<string, unknown>);
      return song({ title: input.title });
    };

    const result = await songsService.createSongsFromUploads(
      'user-a',
      [
        {
          originalname: 'My <Song>.mp3',
          filename: 'stored.mp3',
          size: 123,
          mimetype: 'audio/mpeg',
        },
      ],
      undefined,
      undefined
    );

    assert.equal(result.length, 1);
    assert.deepEqual(inserted[0], {
      userId: 'user-a',
      title: 'My Song',
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      filePath: '/uploads/songs/stored.mp3',
      fileSize: 123,
      mimeType: 'audio/mpeg',
    });
  });

  it('elimina los archivos y la fila de la cancion', async () => {
    const songsDir = path.join(uploadDirPath, 'songs');
    const imagesDir = path.join(uploadDirPath, 'images');
    fs.mkdirSync(songsDir, { recursive: true });
    fs.mkdirSync(imagesDir, { recursive: true });
    fs.writeFileSync(path.join(songsDir, 'delete-me.mp3'), 'audio');
    fs.writeFileSync(path.join(imagesDir, 'delete-me.png'), 'image');

    let removed = '';
    repository.findByIdAndUser = async () =>
      song({
        file_path: '/uploads/songs/delete-me.mp3',
        cover_path: '/uploads/images/delete-me.png',
      });
    repository.remove = async (id) => {
      removed = id;
    };

    await songsService.deleteSong('user-a', 'song-1');

    assert.equal(removed, 'song-1');
    assert.equal(fs.existsSync(path.join(songsDir, 'delete-me.mp3')), false);
    assert.equal(fs.existsSync(path.join(imagesDir, 'delete-me.png')), false);
  });

  it('devuelve el archivo de audio y responde 404 si falta en disco', async () => {
    const songsDir = path.join(uploadDirPath, 'songs');
    fs.mkdirSync(songsDir, { recursive: true });
    fs.writeFileSync(path.join(songsDir, 'stream-me.mp3'), 'audio-bytes');

    repository.findByIdAndUser = async () =>
      song({ file_path: '/uploads/songs/stream-me.mp3' });
    const audio = await songsService.getSongAudioFile('user-a', 'song-1');
    assert.equal(audio.size, 11);
    assert.equal(fs.existsSync(audio.absolutePath), true);

    repository.findByIdAndUser = async () =>
      song({ file_path: '/uploads/songs/missing.mp3' });
    await assert.rejects(
      () => songsService.getSongAudioFile('user-a', 'song-1'),
      (error) => error instanceof NoEncontrado
    );
  });
});
