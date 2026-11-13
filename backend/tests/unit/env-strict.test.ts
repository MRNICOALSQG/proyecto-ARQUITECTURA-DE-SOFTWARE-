import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';

const envModulePath = require.resolve('../helpers/env');

describe('modo estricto de integracion', () => {
  it('falla si REQUIRE_INTEGRATION=1 y TEST_DATABASE_URL no esta definida', () => {
    const result = spawnSync(
      process.execPath,
      ['-e', `require(${JSON.stringify(envModulePath)})`],
      {
        env: {
          ...process.env,
          REQUIRE_INTEGRATION: '1',
          TEST_DATABASE_URL: '',
        },
        encoding: 'utf8',
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /REQUIRE_INTEGRATION=1 exige TEST_DATABASE_URL/);
  });

  it('no falla si REQUIRE_INTEGRATION=1 y TEST_DATABASE_URL esta definida', () => {
    const result = spawnSync(
      process.execPath,
      ['-e', `require(${JSON.stringify(envModulePath)})`],
      {
        env: {
          ...process.env,
          REQUIRE_INTEGRATION: '1',
          TEST_DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/rinne_test_ci',
        },
        encoding: 'utf8',
      }
    );

    assert.equal(result.status, 0, result.stderr);
  });
});
