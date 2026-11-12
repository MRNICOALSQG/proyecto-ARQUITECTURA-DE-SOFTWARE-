/**
 * Configuracion de entorno para toda la suite.
 *
 * Este modulo debe importarse antes que cualquier modulo de `src/` para que
 * `config/env` valide variables controladas por las pruebas. Deliberadamente
 * no lee `backend/.env`: las pruebas nunca deben apuntar a la base real.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const temporaryUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rinne-tests-uploads-'));

export const uploadDirPath = temporaryUploadDir;
export const integrationEnabled = Boolean(process.env.TEST_DATABASE_URL);

process.env.NODE_ENV = 'test';
process.env.APP_VERSION = 'test';
// El servidor de pruebas escucha en un puerto efimero explicito; PORT solo debe
// ser un valor valido para el esquema de `config/env` (minimo 1).
process.env.PORT = '3901';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'rinne-test-secret-with-at-least-32-characters';
process.env.JWT_EXPIRES_IN = '1h';
process.env.UPLOAD_DIR = temporaryUploadDir;
process.env.MAX_FILE_SIZE = '52428800';
process.env.DB_POOL_MAX = '10';
process.env.DB_IDLE_TIMEOUT_MS = '1000';
process.env.DB_CONNECTION_TIMEOUT_MS = '2000';

// Sin TEST_DATABASE_URL las pruebas de integracion se marcan como omitidas.
// La URL de reserva nunca se conecta porque esas pruebas no se ejecutan.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://rinne_test:rinne_test@127.0.0.1:1/rinne_test_unavailable';

export function cleanupUploadDir(): void {
  fs.rmSync(temporaryUploadDir, { recursive: true, force: true });
}
