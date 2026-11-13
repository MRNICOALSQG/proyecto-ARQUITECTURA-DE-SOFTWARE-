import crypto from 'crypto';
import { generateToken } from '../../src/middleware/auth';
import { pool } from '../../src/config/database';
import { resolveMigrationsDir } from '../../src/migrations/files';
import { runMigrations } from '../../src/migrations/runner';
import { assertDisposableDatabaseUrl } from './db-guard';

export interface TestUser {
  id: string;
  email: string;
  username: string;
  token: string;
}

export interface TestSong {
  id: string;
  user_id: string;
  title: string;
  file_path: string;
}

export interface TestPlaylist {
  id: string;
  user_id: string;
  name: string;
}

let prepared: Promise<void> | undefined;

function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;

  if (url === undefined || url.trim() === '') {
    throw new Error(
      'TEST_DATABASE_URL no esta definida. La suite de integracion requiere ' +
        'una base PostgreSQL desechable.'
    );
  }

  return url;
}

export function prepareDatabase(): Promise<void> {
  if (!prepared) {
    prepared = (async () => {
      const url = testDatabaseUrl();

      // Todas las validaciones ocurren antes de tocar la base de datos.
      assertDisposableDatabaseUrl(url);

      await runMigrations({ migrationsDir: resolveMigrationsDir() });
      await truncateAll();
    })();
  }

  return prepared;
}

/** Deja la base en un estado conocido entre archivos de integracion. */
export async function truncateAll(): Promise<void> {
  await pool.query(
    `TRUNCATE TABLE favorites, playlist_songs, playlists, songs, revoked_tokens,
       user_preferences, users RESTART IDENTITY CASCADE`
  );
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export async function createUser(username = 'Test User'): Promise<TestUser> {
  const email = `user-${crypto.randomUUID()}@example.test`;
  const result = await pool.query<{ id: string; email: string; username: string }>(
    'INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id, email, username',
    [email, 'not-a-real-hash', username]
  );
  const user = result.rows[0];
  const { token } = generateToken(user.id);

  return { ...user, token };
}

export async function createSong(
  userId: string,
  overrides: { title?: string; file_path?: string; mime_type?: string } = {}
): Promise<TestSong> {
  const result = await pool.query<TestSong>(
    `INSERT INTO songs (user_id, title, artist, album, file_path, file_size, mime_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, title, file_path`,
    [
      userId,
      overrides.title ?? 'Test Song',
      'Test Artist',
      'Test Album',
      overrides.file_path ?? `/uploads/songs/${crypto.randomUUID()}.mp3`,
      0,
      overrides.mime_type ?? 'audio/mpeg',
    ]
  );

  return result.rows[0];
}

export async function createPlaylist(userId: string, name = 'Test Playlist'): Promise<TestPlaylist> {
  const result = await pool.query<TestPlaylist>(
    'INSERT INTO playlists (user_id, name) VALUES ($1, $2) RETURNING id, user_id, name',
    [userId, name]
  );

  return result.rows[0];
}

export async function countRows(table: string, where: string, params: unknown[]): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table} WHERE ${where}`,
    params
  );

  return Number(result.rows[0].count);
}
