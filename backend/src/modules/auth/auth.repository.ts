import { query } from '../../config/database';

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
}

export interface UserWithPassword extends UserRecord {
  password_hash: string;
}

export async function findIdByEmail(email: string): Promise<string | undefined> {
  const result = await query('SELECT id FROM users WHERE email = $1', [email]);
  return result.rows[0]?.id;
}

export async function createUser(
  email: string,
  passwordHash: string,
  username: string
): Promise<UserRecord> {
  const result = await query(
    'INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id, email, username, avatar_url, created_at',
    [email, passwordHash, username]
  );
  return result.rows[0];
}

export async function findByEmailWithPassword(
  email: string
): Promise<UserWithPassword | undefined> {
  const result = await query(
    'SELECT id, email, username, avatar_url, password_hash, created_at FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0];
}

export async function revokeToken(jti: string, expiresAt: number): Promise<void> {
  await query(
    'INSERT INTO revoked_tokens (token_jti, expires_at) VALUES ($1, to_timestamp($2)) ON CONFLICT DO NOTHING',
    [jti, expiresAt]
  );
}

export async function updateProfile(
  userId: string,
  username: string,
  avatarUrl: string | null
): Promise<UserRecord | undefined> {
  const result = await query(
    'UPDATE users SET username = $1, avatar_url = $2 WHERE id = $3 RETURNING id, email, username, avatar_url, created_at',
    [username, avatarUrl, userId]
  );
  return result.rows[0];
}
