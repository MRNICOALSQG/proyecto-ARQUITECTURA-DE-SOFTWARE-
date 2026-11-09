import { pool } from '../config/database';
import { env } from '../config/env';
import { resolveMigrationsDir } from './files';
import { runMigrations } from './runner';

async function main(): Promise<void> {
  const migrationsDir = resolveMigrationsDir(env.MIGRATIONS_DIR);
  console.log(`Directorio de migraciones: ${migrationsDir}`);
  await runMigrations({ migrationsDir });
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Migraciones fallidas: ${message}`);
    try {
      await pool.end();
    } catch {
      // The pool may not have opened any connection; ignore cleanup errors.
    }
    process.exitCode = 1;
  });
