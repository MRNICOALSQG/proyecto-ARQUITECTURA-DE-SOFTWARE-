import '../helpers/env';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertDisposableDatabaseUrl } from '../helpers/db-guard';

const validUrls = [
  'postgresql://postgres:postgres@127.0.0.1:5432/rinne_test_ci',
  'postgres://user:pass@localhost/rinne_local_test',
  'postgresql://postgres@[::1]:5432/rinne_ci',
  'postgresql://postgres@postgres:5432/rinne_test',
  'postgresql://postgres@db:5432/rinne_ci?sslmode=disable',
];

const invalidUrls: Array<[string, string | undefined]> = [
  ['sin definir', undefined],
  ['vacia', ''],
  ['solo espacios', '   '],
  ['no es una URL', 'not-a-url'],
  ['protocolo no postgres', 'mysql://localhost/rinne_test'],
  ['base de produccion', 'postgresql://localhost/rinne_produccion'],
  ['nombre production', 'postgresql://localhost/production'],
  ['nombre prod', 'postgresql://localhost/rinne_prod'],
  ['nombre postgres', 'postgresql://localhost/postgres'],
  ['nombre rinne', 'postgresql://localhost/rinne'],
  ['sufijo no exacto', 'postgresql://localhost/rinne_test_production'],
  ['prefijo test', 'postgresql://localhost/test_rinne'],
  ['ruta adicional', 'postgresql://localhost/rinne_test/extra'],
  ['host remoto', 'postgresql://db.example.com/rinne_test'],
  ['host IP no autorizado', 'postgresql://10.0.0.5/rinne_test'],
  ['sin nombre de base', 'postgresql://localhost/'],
];

describe('guard de base de datos desechable', () => {
  for (const url of validUrls) {
    it(`acepta ${url}`, () => {
      assert.doesNotThrow(() => assertDisposableDatabaseUrl(url));
    });
  }

  for (const [label, url] of invalidUrls) {
    it(`rechaza ${label}`, () => {
      assert.throws(
        () => assertDisposableDatabaseUrl(url),
        /TEST_DATABASE_URL no es segura/
      );
    });
  }

  it('rechaza cualquier nombre real aunque contenga test o ci', () => {
    for (const name of ['rinne_produccion', 'rinne_prod', 'production', 'postgres']) {
      assert.throws(
        () => assertDisposableDatabaseUrl(`postgresql://localhost/${name}`),
        /TEST_DATABASE_URL no es segura/
      );
    }
  });
});
