import type { PoolClient } from 'pg';
import { pool } from '../config/database';
import { loadMigrations, type MigrationFile } from './files';
import {
  compareSnapshots,
  expectedSnapshot,
  SCHEMA_MIGRATIONS_TABLE,
  takeSnapshot,
} from './schema';

// Fixed key for pg_advisory_lock(bigint). Every migration process uses the same
// key, so two instances cannot apply migrations concurrently.
const ADVISORY_LOCK_KEY = 8254928301;

interface AppliedMigration {
  version: string;
  name: string;
  checksum: string;
  applied_at: Date;
  execution_ms: number;
  baseline: boolean;
}

export interface RunMigrationsOptions {
  migrationsDir: string;
}

async function ensureHistoryTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${SCHEMA_MIGRATIONS_TABLE} (
      version VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      execution_ms INTEGER NOT NULL DEFAULT 0,
      baseline BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
}

async function getAppliedMigrations(client: PoolClient): Promise<AppliedMigration[]> {
  const result = await client.query<AppliedMigration>(
    `SELECT version, name, checksum, applied_at, execution_ms, baseline
       FROM ${SCHEMA_MIGRATIONS_TABLE}
      ORDER BY version::integer`
  );
  return result.rows;
}

function validateAppliedMigrations(
  applied: AppliedMigration[],
  migrations: MigrationFile[]
): void {
  const filesByVersion = new Map(migrations.map((migration) => [migration.version, migration]));

  for (const row of applied) {
    const file = filesByVersion.get(row.version);
    if (!file) {
      throw new Error(
        `La migracion ${row.version} esta registrada en ${SCHEMA_MIGRATIONS_TABLE} ` +
          'pero su archivo ya no existe. No se puede continuar sin intervencion manual.'
      );
    }

    if (file.checksum !== row.checksum) {
      throw new Error(
        `La migracion ${file.fileName} cambio despues de aplicarse. ` +
          `Checksum registrado: ${row.checksum}. Checksum actual: ${file.checksum}. ` +
          'No modifiques migraciones aplicadas; crea una nueva.'
      );
    }

    if (file.name !== row.name) {
      throw new Error(
        `La migracion ${file.fileName} cambio de nombre despues de aplicarse ` +
          `(registrado: ${row.name}).`
      );
    }
  }
}

function getMaxAppliedNumericVersion(applied: AppliedMigration[]): number {
  let maxVersion = 0;

  for (const row of applied) {
    const numericVersion = Number.parseInt(row.version, 10);
    if (!Number.isSafeInteger(numericVersion) || numericVersion <= 0) {
      throw new Error(
        `La version registrada ${row.version} en ${SCHEMA_MIGRATIONS_TABLE} no es numerica valida.`
      );
    }
    if (numericVersion > maxVersion) {
      maxVersion = numericVersion;
    }
  }

  return maxVersion;
}

async function listUserTables(client: PoolClient): Promise<string[]> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`
  );

  return result.rows
    .map((row) => row.table_name)
    .filter((tableName) => tableName !== SCHEMA_MIGRATIONS_TABLE);
}

// An existing database created by database/init.sql has the initial schema but
// no migration history. Adopt it as baseline only after proving that its schema
// matches 001 exactly. Nothing is executed against the existing tables.
async function adoptInitialBaseline(
  client: PoolClient,
  migration: MigrationFile
): Promise<void> {
  const actual = await takeSnapshot(client, [SCHEMA_MIGRATIONS_TABLE]);
  const problems = compareSnapshots(actual, expectedSnapshot());

  if (problems.length > 0) {
    throw new Error(
      'La base de datos existente no tiene historial de migraciones y su esquema ' +
        'no coincide exactamente con 001_esquema_inicial. No se ha registrado ' +
        'ninguna migracion ni se ha modificado el esquema.\n' +
        problems.map((problem) => `  - ${problem}`).join('\n')
    );
  }

  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO ${SCHEMA_MIGRATIONS_TABLE}
         (version, name, checksum, execution_ms, baseline)
       VALUES ($1, $2, $3, 0, TRUE)`,
      [migration.version, migration.name, migration.checksum]
    );
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original error; the caller aborts the process.
    }
    throw error;
  }

  console.log(
    `Baseline adoptado para ${migration.fileName}: esquema verificado, SQL no ejecutado.`
  );
}

async function applyMigration(
  client: PoolClient,
  migration: MigrationFile
): Promise<number> {
  const startedAt = Date.now();
  let transactionOpen = false;

  try {
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query(migration.sql);

    const elapsed = Date.now() - startedAt;
    await client.query(
      `INSERT INTO ${SCHEMA_MIGRATIONS_TABLE}
         (version, name, checksum, execution_ms, baseline)
       VALUES ($1, $2, $3, $4, FALSE)`,
      [migration.version, migration.name, migration.checksum, elapsed]
    );
    await client.query('COMMIT');
    transactionOpen = false;
    return elapsed;
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original error; the caller aborts the process.
      }
    }
    throw error;
  }
}

export async function runMigrations(options: RunMigrationsOptions): Promise<void> {
  const migrations = loadMigrations(options.migrationsDir);

  if (migrations.length === 0) {
    throw new Error(`No hay archivos .sql en ${options.migrationsDir}.`);
  }

  if (migrations[0].version !== '001') {
    throw new Error(
      `La primera migracion debe ser 001_*.sql. Encontrada: ${migrations[0].fileName}.`
    );
  }

  const client = await pool.connect();
  let lockAcquired = false;

  try {
    console.log('Adquiriendo bloqueo de migraciones...');
    await client.query('SELECT pg_advisory_lock($1::bigint)', [ADVISORY_LOCK_KEY]);
    lockAcquired = true;
    console.log('Bloqueo adquirido.');

    await ensureHistoryTable(client);

    const applied = await getAppliedMigrations(client);
    validateAppliedMigrations(applied, migrations);

    const appliedVersions = new Set(applied.map((row) => row.version));
    let pending = migrations.filter((migration) => !appliedVersions.has(migration.version));

    console.log(
      `Migraciones registradas: ${applied.length}. Pendientes: ${pending.length}.`
    );

    if (pending.length === 0) {
      console.log('No hay migraciones pendientes.');
      return;
    }

    if (applied.length === 0) {
      const userTables = await listUserTables(client);

      if (userTables.length > 0) {
        const baseline = pending[0];
        if (baseline.version !== '001') {
          throw new Error(
            'La base contiene tablas pero no historial de migraciones y no existe 001. ' +
              'Deten el proceso y revisa el esquema manualmente.'
          );
        }

        console.log(
          `Base existente sin historial (${userTables.length} tablas). ` +
            'Verificando el esquema antes de adoptarla...'
        );
        await adoptInitialBaseline(client, baseline);
        pending = pending.slice(1);
      } else {
        console.log('Base vacia detectada. Se aplicara el esquema inicial.');
      }
    }

    const maxAppliedVersion = getMaxAppliedNumericVersion(applied);

    for (const migration of pending) {
      if (migration.numericVersion <= maxAppliedVersion) {
        throw new Error(
          `La migracion ${migration.fileName} (version ${migration.numericVersion}) ` +
            `no es mayor que la version maxima ya aplicada (${maxAppliedVersion}). ` +
            'Las migraciones pendientes deben tener una version estrictamente mayor; ' +
            'no se aplico ninguna migracion fuera de orden.'
        );
      }
    }

    for (const migration of pending) {
      console.log(`Aplicando ${migration.fileName}...`);
      const elapsed = await applyMigration(client, migration);
      console.log(`Aplicada ${migration.fileName} en ${elapsed} ms.`);
    }

    console.log('Migraciones completadas.');
  } finally {
    if (lockAcquired) {
      try {
        await client.query('SELECT pg_advisory_unlock($1::bigint)', [ADVISORY_LOCK_KEY]);
      } catch (error) {
        console.warn(
          'No se pudo liberar el bloqueo de migraciones:',
          error instanceof Error ? error.message : error
        );
      }
    }
    client.release();
  }
}
