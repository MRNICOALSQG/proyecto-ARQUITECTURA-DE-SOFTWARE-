/**
 * Validacion pura de `TEST_DATABASE_URL`.
 *
 * La suite de integracion ejecuta migraciones y `TRUNCATE`, por lo que la URL
 * debe apuntar a una base inequivocamente desechable. No se aceptan subcadenas:
 * el nombre debe terminar exactamente en `_test` o `_ci`. Tampoco se aceptan
 * hosts remotos ni nombres de produccion conocidos.
 *
 * Este modulo no importa el pool de PostgreSQL ni ningun modulo de `src/`, de
 * modo que puede probarse sin base de datos y se ejecuta antes de cualquier
 * operacion destructiva.
 */

const ALLOWED_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

// Hosts admitidos: loopback (CI y cluster efimero local) y los nombres de
// servicio habituales de un PostgreSQL de pruebas en Docker Compose.
const ALLOWED_HOSTS = new Set([
  '127.0.0.1',
  'localhost',
  '::1',
  '[::1]',
  'postgres',
  'db',
]);

const DISPOSABLE_DATABASE_NAME = /^[A-Za-z0-9_]+_(test|ci)$/;

// Defensa redundante: aunque el sufijo ya los rechaza, se listan de forma
// explicita para que el mensaje de error sea claro y para cubrir variantes que
// pudieran anadirse en el futuro.
const FORBIDDEN_DATABASE_NAMES = new Set([
  'postgres',
  'production',
  'prod',
  'rinne',
  'rinne_prod',
  'rinne_produccion',
  'rinne_production',
]);

function fail(reason: string): never {
  throw new Error(`TEST_DATABASE_URL no es segura: ${reason}`);
}

/**
 * Lanza si la URL no apunta a una base de pruebas desechable. No realiza
 * ninguna conexion ni consulta; solo valida la configuracion.
 */
export function assertDisposableDatabaseUrl(rawUrl: string | undefined): void {
  if (rawUrl === undefined || rawUrl.trim() === '') {
    fail('la variable no esta definida o esta vacia.');
  }

  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    fail('no es una URL valida.');
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    fail(`el protocolo ${url.protocol} no es postgres/postgresql.`);
  }

  const hostname = url.hostname.toLowerCase();

  if (hostname === '') {
    fail('la URL no incluye un hostname.');
  }

  if (!ALLOWED_HOSTS.has(hostname)) {
    fail(`el host ${url.hostname} no esta autorizado para pruebas.`);
  }

  const rawDatabaseName = url.pathname.replace(/^\//, '');

  if (rawDatabaseName === '') {
    fail('la URL no incluye un nombre de base de datos.');
  }

  if (rawDatabaseName.includes('/')) {
    fail('el nombre de base de datos no puede contener rutas adicionales.');
  }

  let databaseName: string;

  try {
    databaseName = decodeURIComponent(rawDatabaseName);
  } catch {
    fail('el nombre de base de datos no es una secuencia URI valida.');
  }

  if (FORBIDDEN_DATABASE_NAMES.has(databaseName.toLowerCase())) {
    fail(`el nombre ${databaseName} corresponde a una base real o de produccion.`);
  }

  if (!DISPOSABLE_DATABASE_NAME.test(databaseName)) {
    fail(
      `el nombre ${databaseName} debe terminar exactamente en _test o _ci ` +
        '(por ejemplo rinne_test_ci o rinne_local_test).'
    );
  }
}
