import bcrypt from 'bcryptjs';
import { decodeToken, generateToken } from '../../middleware/auth';
import { HttpError, NoEncontrado } from '../../shared/http-error';
import { sanitizeText } from '../../shared/sanitize';
import * as authRepository from './auth.repository';
import type { UserRecord, UserWithPassword } from './auth.repository';

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}

function toPublicUser(user: UserRecord | UserWithPassword): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatar_url: user.avatar_url,
  };
}

export async function register(input: {
  email: string;
  password: string;
  username?: string;
}): Promise<AuthResult> {
  const existing = await authRepository.findIdByEmail(input.email);

  if (existing) {
    throw new HttpError(409, 'Este email ya está registrado');
  }

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(input.password, salt);

  // El username explicito y el fallback derivado del email pasan por la misma
  // regla de saneamiento antes de persistirse.
  const fallbackUsername = sanitizeText(input.email.split('@')[0]).trim();
  const username = sanitizeText(input.username || fallbackUsername).trim();

  const user = await authRepository.createUser(input.email, passwordHash, username);

  const { token } = generateToken(user.id);
  return { user: toPublicUser(user), token };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const user = await authRepository.findByEmailWithPassword(input.email);

  if (!user) {
    throw new HttpError(401, 'Email o contraseña incorrectos');
  }

  const isValid = await bcrypt.compare(input.password, user.password_hash);

  if (!isValid) {
    throw new HttpError(401, 'Email o contraseña incorrectos');
  }

  const { token } = generateToken(user.id);
  return { user: toPublicUser(user), token };
}

/**
 * Revoca el token del encabezado Authorization. Cualquier fallo (token ausente,
 * invalido o expirado) se propaga para que el controlador conserve la respuesta
 * historica de logout.
 */
export async function logout(authorizationHeader?: string): Promise<void> {
  if (!authorizationHeader) {
    return;
  }

  const token = authorizationHeader.split(' ')[1];
  const decoded = decodeToken(token);

  await authRepository.revokeToken(decoded.jti, decoded.exp);
}

export async function updateProfile(
  userId: string,
  input: { username?: string; avatarUrl?: string | null }
): Promise<UserRecord> {
  if (!input.username) {
    throw new HttpError(400, 'Username es requerido');
  }

  const username = sanitizeText(input.username).trim();
  const user = await authRepository.updateProfile(userId, username, input.avatarUrl || null);

  // El usuario autenticado puede haber sido eliminado entre la verificacion del
  // token y el UPDATE: se responde 404 en lugar de un 200 con `user` indefinido.
  if (!user) {
    throw new NoEncontrado('Usuario no encontrado');
  }

  return user;
}
