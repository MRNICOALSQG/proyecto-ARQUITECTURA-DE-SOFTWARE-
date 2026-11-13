import '../helpers/env';
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { generateToken } from '../../src/middleware/auth';
import { HttpError, NoEncontrado } from '../../src/shared/http-error';
import * as authService from '../../src/modules/auth/auth.service';

type AuthRepository = typeof import('../../src/modules/auth/auth.repository');

const repository = require('../../src/modules/auth/auth.repository') as AuthRepository;
const originalRepository = { ...repository };

function errorStatus(error: unknown): number | undefined {
  return error instanceof HttpError ? error.status : undefined;
}

describe('auth.service', () => {
  afterEach(() => {
    Object.assign(repository, originalRepository);
  });

  it('responde 409 cuando el email ya esta registrado', async () => {
    repository.findIdByEmail = async () => 'existing-user';

    await assert.rejects(
      () => authService.register({ email: 'used@example.test', password: 'password123' }),
      (error) => errorStatus(error) === 409
    );
  });

  it('registra un usuario, sanea el username y no devuelve el hash', async () => {
    let received: { email?: string; hash?: string; username?: string } = {};
    repository.findIdByEmail = async () => undefined;
    repository.createUser = async (email, passwordHash, username) => {
      received = { email, hash: passwordHash, username };
      return {
        id: 'user-1',
        email,
        username,
        avatar_url: null,
        created_at: '2026-01-01T00:00:00.000Z',
      };
    };

    const result = await authService.register({
      email: 'john.doe@example.test',
      password: 'password123',
    });

    assert.equal(received.email, 'john.doe@example.test');
    assert.equal(received.username, 'john.doe');
    assert.notEqual(received.hash, 'password123');
    assert.equal(await bcrypt.compare('password123', received.hash ?? ''), true);
    assert.equal(result.user.id, 'user-1');
    assert.equal((result.user as unknown as Record<string, unknown>).password_hash, undefined);
    assert.equal(typeof result.token, 'string');
  });

  it('sanea un username explicito antes de persistirlo', async () => {
    let receivedUsername = '';
    repository.findIdByEmail = async () => undefined;
    repository.createUser = async (email, _passwordHash, username) => {
      receivedUsername = username;
      return { id: 'user-1', email, username, avatar_url: null, created_at: '' };
    };

    await authService.register({
      email: 'jane@example.test',
      password: 'password123',
      username: '<Jane>',
    });

    assert.equal(receivedUsername, 'Jane');
  });

  it('responde 401 con usuario inexistente o contraseña incorrecta', async () => {
    repository.findByEmailWithPassword = async () => undefined;
    await assert.rejects(
      () => authService.login({ email: 'missing@example.test', password: 'password123' }),
      (error) => errorStatus(error) === 401
    );

    repository.findByEmailWithPassword = async () => ({
      id: 'user-1',
      email: 'user@example.test',
      username: 'User',
      avatar_url: null,
      created_at: '',
      password_hash: await bcrypt.hash('correct-password', 4),
    });

    await assert.rejects(
      () => authService.login({ email: 'user@example.test', password: 'wrong-password' }),
      (error) => errorStatus(error) === 401
    );
  });

  it('inicia sesion con credenciales validas', async () => {
    repository.findByEmailWithPassword = async () => ({
      id: 'user-1',
      email: 'user@example.test',
      username: 'User',
      avatar_url: null,
      created_at: '',
      password_hash: await bcrypt.hash('correct-password', 4),
    });

    const result = await authService.login({
      email: 'user@example.test',
      password: 'correct-password',
    });

    assert.equal(result.user.id, 'user-1');
    assert.equal(typeof result.token, 'string');
    assert.equal((result.user as unknown as Record<string, unknown>).password_hash, undefined);
  });

  it('actualiza el perfil saneando el username', async () => {
    let received: unknown[] = [];
    repository.updateProfile = async (...args: unknown[]) => {
      received = args;
      return {
        id: 'user-1',
        email: 'user@example.test',
        username: 'New Name',
        avatar_url: null,
        created_at: '',
      };
    };

    const user = await authService.updateProfile('user-1', { username: '<New Name>' });
    assert.equal(user.username, 'New Name');
    assert.deepEqual(received, ['user-1', 'New Name', null]);
  });

  it('responde 400 sin username y 404 si el usuario desaparecio', async () => {
    await assert.rejects(
      () => authService.updateProfile('user-1', {}),
      (error) => errorStatus(error) === 400
    );

    repository.updateProfile = async () => undefined;
    await assert.rejects(
      () => authService.updateProfile('user-1', { username: 'Valid' }),
      (error) => error instanceof NoEncontrado && error.status === 404
    );
  });

  it('revoca el token del encabezado Authorization', async () => {
    const { token, jti } = generateToken('user-1');
    let received: { jti?: string; exp?: number } = {};
    repository.revokeToken = async (revokedJti, expiresAt) => {
      received = { jti: revokedJti, exp: expiresAt };
    };

    await authService.logout(`Bearer ${token}`);

    assert.equal(received.jti, jti);
    assert.equal(typeof received.exp, 'number');
  });

  it('no hace nada en logout sin encabezado y propaga tokens invalidos', async () => {
    let called = false;
    repository.revokeToken = async () => {
      called = true;
    };

    await authService.logout(undefined);
    assert.equal(called, false);

    await assert.rejects(() => authService.logout('Bearer not-a-valid-token'));
  });
});
