import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load the backend .env regardless of the current working directory.
// Works both from src/config (ts-node-dev) and dist/config (compiled).
const backendRoot = path.resolve(__dirname, '..', '..');
const envFile = path.join(backendRoot, '.env');

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_VERSION: z.string().min(1, 'APP_VERSION no puede estar vacío').default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  FRONTEND_URL: z.string().url('FRONTEND_URL debe ser una URL válida').default('http://localhost:5173'),

  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\/.+/i, 'DATABASE_URL debe ser una URL postgres:// o postgresql:// válida'),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+\s*[smhdwy]$/i, 'JWT_EXPIRES_IN debe tener un formato como 15m, 24h o 7d')
    .default('24h'),

  UPLOAD_DIR: z.string().min(1, 'UPLOAD_DIR no puede estar vacío').default('./uploads'),
  MAX_FILE_SIZE: z.coerce.number().int().positive().default(52_428_800),

  DB_POOL_MAX: z.coerce.number().int().positive().default(20),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(30_000),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(2_000),

  // Solo lo usa el runner de migraciones. Si no se define, se busca
  // ../database/migrations a partir del directorio de trabajo.
  MIGRATIONS_DIR: z.string().min(1, 'MIGRATIONS_DIR no puede estar vacío').optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
    .join('\n');

  console.error(
    `❌ Configuración de entorno inválida:\n${details}\n\n` +
      'Revisa backend/.env (puedes partir de backend/.env.example). ' +
      'No se muestran los valores por seguridad.'
  );
  process.exit(1);
}

const uploadDir = path.isAbsolute(parsed.data.UPLOAD_DIR)
  ? parsed.data.UPLOAD_DIR
  : path.resolve(backendRoot, parsed.data.UPLOAD_DIR);

export const env = {
  ...parsed.data,
  UPLOAD_DIR: uploadDir,
};

export type Env = typeof env;
