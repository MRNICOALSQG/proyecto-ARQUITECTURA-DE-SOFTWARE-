import '../helpers/env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app';
import { integrationSkipReason } from '../helpers/env';
import { closeDatabase, createUser, prepareDatabase } from '../helpers/db';
import { requestJson } from '../helpers/api';
import { startTestServer, type TestServer } from '../helpers/server';

interface PreferencesView {
  background_type: string;
  background_value: string;
  hud_color: string;
  hud_opacity: number;
  particles_type: string;
  particles_color: string;
  particles_speed: number;
  particles_opacity: number;
  background_size: string;
  background_position: string;
  background_repeat: string;
}

interface PreferencesResponse {
  preferences: PreferencesView;
}

describe('preferencias (PostgreSQL real)', { skip: integrationSkipReason() }, () => {
  let server: TestServer;

  before(async () => {
    await prepareDatabase();
    server = await startTestServer(createApp());
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  it('devuelve los valores por defecto de un usuario nuevo', async () => {
    const user = await createUser();

    const result = await requestJson<PreferencesResponse>(
      server.baseUrl,
      '/api/preferences',
      { token: user.token }
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.preferences.background_type, 'solid');
    assert.equal(result.body.preferences.background_value, '#131315');
    assert.equal(result.body.preferences.hud_color, '#00dbe9');
    assert.equal(result.body.preferences.hud_opacity, 0.8);
    assert.equal(result.body.preferences.particles_type, 'none');
  });

  it('actualiza solo los campos enviados y conserva el resto', async () => {
    const user = await createUser();

    const updated = await requestJson<PreferencesResponse>(
      server.baseUrl,
      '/api/preferences',
      {
        method: 'PUT',
        token: user.token,
        body: {
          background_type: 'image',
          background_value: '/uploads/images/background.png',
          hud_color: '#ff0000',
          hud_opacity: 0.3,
          particles_type: 'snow',
        },
      }
    );

    assert.equal(updated.status, 200);
    assert.equal(updated.body.preferences.background_type, 'image');
    assert.equal(updated.body.preferences.background_value, '/uploads/images/background.png');
    assert.equal(updated.body.preferences.hud_color, '#ff0000');
    assert.equal(updated.body.preferences.hud_opacity, 0.3);
    assert.equal(updated.body.preferences.particles_type, 'snow');
    assert.equal(updated.body.preferences.particles_color, 'white');

    const fetched = await requestJson<PreferencesResponse>(
      server.baseUrl,
      '/api/preferences',
      { token: user.token }
    );
    assert.deepEqual(fetched.body.preferences, updated.body.preferences);
  });

  it('rechaza valores fuera de rango', async () => {
    const user = await createUser();

    const opacity = await requestJson(server.baseUrl, '/api/preferences', {
      method: 'PUT',
      token: user.token,
      body: { hud_opacity: 2 },
    });
    assert.equal(opacity.status, 400);

    const particles = await requestJson(server.baseUrl, '/api/preferences', {
      method: 'PUT',
      token: user.token,
      body: { particles_type: 'invalid' },
    });
    assert.equal(particles.status, 400);
  });

  it('mantiene las preferencias aisladas por usuario', async () => {
    const first = await createUser();
    const second = await createUser();

    await requestJson(server.baseUrl, '/api/preferences', {
      method: 'PUT',
      token: first.token,
      body: { hud_color: '#123456' },
    });

    const secondPreferences = await requestJson<PreferencesResponse>(
      server.baseUrl,
      '/api/preferences',
      { token: second.token }
    );

    assert.equal(secondPreferences.status, 200);
    assert.equal(secondPreferences.body.preferences.hud_color, '#00dbe9');
  });

  it('exige token para leer preferencias', async () => {
    const result = await requestJson(server.baseUrl, '/api/preferences');
    assert.equal(result.status, 401);
  });
});
