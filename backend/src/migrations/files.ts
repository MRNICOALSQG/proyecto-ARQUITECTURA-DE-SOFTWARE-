import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface MigrationFile {
  /** Prefijo numerico de la version, tal como aparece en el nombre (p. ej. "001"). */
  version: string;
  /** Version numerica usada para ordenar. */
  numericVersion: number;
  /** Nombre descriptivo sin el prefijo ni la extension. */
  name: string;
  fileName: string;
  filePath: string;
  sql: string;
  /** SHA-256 del contenido normalizado (CRLF -> LF). */
  checksum: string;
}

const MIGRATION_FILE_PATTERN = /^(\d{3,})[_-]([A-Za-z0-9][A-Za-z0-9_-]*)\.sql$/;

// Compute checksums over LF so the same migration validates on Windows and Linux.
export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n?/g, '\n');
}

export function computeChecksum(content: string): string {
  return crypto.createHash('sha256').update(normalizeLineEndings(content), 'utf8').digest('hex');
}

function directoryHasSqlFiles(directory: string): boolean {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    return false;
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .some((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.sql'));
}

// Resolve the migrations directory. MIGRATIONS_DIR wins; otherwise try the
// repository layout both from backend/ (cwd) and from the compiled dist/ tree.
export function resolveMigrationsDir(explicitDir?: string): string {
  if (explicitDir && explicitDir.trim() !== '') {
    const resolved = path.resolve(explicitDir);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error(`MIGRATIONS_DIR no existe o no es un directorio: ${resolved}`);
    }
    return resolved;
  }

  const candidates = [
    path.resolve(process.cwd(), 'database', 'migrations'),
    path.resolve(process.cwd(), '..', 'database', 'migrations'),
    path.resolve(__dirname, '..', '..', '..', 'database', 'migrations'),
  ];

  for (const candidate of candidates) {
    if (directoryHasSqlFiles(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'No se encontro el directorio de migraciones. ' +
      `Candidatos comprobados: ${candidates.join(', ')}. ` +
      'Define MIGRATIONS_DIR con la ruta correcta.'
  );
}

export function loadMigrations(directory: string): MigrationFile[] {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(`El directorio de migraciones no existe: ${directory}`);
  }

  const fileNames = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.sql'))
    .map((entry) => entry.name);

  const migrations: MigrationFile[] = [];
  const seenVersions = new Map<string, string>();
  const seenNumericVersions = new Map<number, string>();

  for (const fileName of fileNames.sort()) {
    const match = MIGRATION_FILE_PATTERN.exec(fileName);
    if (!match) {
      throw new Error(
        `Nombre de migracion invalido: ${fileName}. ` +
          'Usa NNN_nombre.sql (por ejemplo 002_agregar_tabla.sql).'
      );
    }

    const version = match[1];
    const name = match[2];
    const numericVersion = Number.parseInt(version, 10);

    if (!Number.isSafeInteger(numericVersion) || numericVersion <= 0) {
      throw new Error(`Version de migracion invalida en ${fileName}.`);
    }

    const previous = seenVersions.get(version);
    if (previous) {
      throw new Error(`Version duplicada ${version}: ${previous} y ${fileName}.`);
    }
    seenVersions.set(version, fileName);

    const previousNumeric = seenNumericVersions.get(numericVersion);
    if (previousNumeric) {
      throw new Error(
        `Version numerica duplicada ${numericVersion}: ${previousNumeric} y ${fileName}.`
      );
    }
    seenNumericVersions.set(numericVersion, fileName);

    const filePath = path.join(directory, fileName);
    const sql = fs.readFileSync(filePath, 'utf8');

    migrations.push({
      version,
      numericVersion,
      name,
      fileName,
      filePath,
      sql,
      checksum: computeChecksum(sql),
    });
  }

  migrations.sort(
    (a, b) => a.numericVersion - b.numericVersion || a.fileName.localeCompare(b.fileName)
  );

  return migrations;
}
