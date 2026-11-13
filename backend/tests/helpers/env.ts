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

const TEMP_UPLOAD_PREFIX = 'rinne-tests-uploads-';
const STALE_TEMP_UPLOAD_AGE_MS = 60 * 60 * 1000;

export const integrationEnabled = Boolean(process.env.TEST_DATABASE_URL);
export const integrationRequired = process.env.REQUIRE_INTEGRATION === '1';

// El modo estricto se valida antes de crear cualquier recurso temporal.
if (integrationRequired && !integrationEnabled) {
  throw new Error(
    'REQUIRE_INTEGRATION=1 exige TEST_DATABASE_URL. Configura una base ' +
      'PostgreSQL desechable (por ejemplo rinne_test_ci) antes de ejecutar la suite.'
  );
}

/**
 * Elimina directorios de ejecuciones anteriores que hayan quedado huerfanos
 * (por ejemplo, si un proceso fue terminado a la fuerza). Solo toca directorios
 * con el prefijo de la suite y con mas de una hora de antiguedad, de modo que
 * nunca borra el directorio de otra ejecucion activa.
 */
function removeStaleUploadDirs(): void {
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(os.tmpdir(), { withFileTypes: true });
  } catch {
    return;
  }

  const cutoff = Date.now() - STALE_TEMP_UPLOAD_AGE_MS;

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(TEMP_UPLOAD_PREFIX)) {
      continue;
    }

    const target = path.join(os.tmpdir(), entry.name);

    try {
      if (fs.statSync(target).mtimeMs < cutoff) {
        fs.rmSync(target, {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 100,
        });
      }
    } catch {
      // Un directorio bloqueado o ya eliminado no debe romper la suite.
    }
  }
}

removeStaleUploadDirs();

const temporaryUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_UPLOAD_PREFIX));

export const uploadDirPath = temporaryUploadDir;

/**
 * Motivo de omision que `node:test` muestra en el reporte. Sin PostgreSQL se
 * ejecutan solo las pruebas unitarias; el motivo deja constancia explicita.
 */
export function integrationSkipReason(): false | string {
  return integrationEnabled
    ? false
    : 'TEST_DATABASE_URL no definida: se omite la suite de integracion PostgreSQL';
}

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

let uploadDirCleaned = false;

/**
 * Limpieza idempotente del directorio temporal de la suite. Se invoca al final
 * de las pruebas de uploads y tambien desde el evento `exit`, de modo que se
 * ejecuta aunque una prueba falle.
 */
export function cleanupUploadDir(): void {
  if (uploadDirCleaned) {
    return;
  }

  uploadDirCleaned = true;

  try {
    // En Windows un archivo puede seguir abierto unos milisegundos despues de
    // que termina la prueba; los reintentos evitan dejar el directorio huerfano.
    fs.rmSync(temporaryUploadDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  } catch {
    // La limpieza no debe convertir una prueba correcta en fallida. El barrido
    // de directorios antiguos del proximo arranque lo eliminara.
  }
}

process.once('exit', cleanupUploadDir);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    cleanupUploadDir();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  });
}
