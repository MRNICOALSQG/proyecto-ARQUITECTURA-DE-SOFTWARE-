import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { HttpError } from './http-error';

const UPLOAD_URL_PREFIX = '/uploads/';

export interface CreateUploaderOptions {
  /** Subdirectorio de `UPLOAD_DIR` donde se guardan los archivos. */
  folder: string;
  /** Lista cerrada de MIME permitidos o predicado para familias completas. */
  allowedMimeTypes: string[] | ((mimetype: string) => boolean);
  /** Tamano maximo por archivo, en bytes. */
  maxFileSize: number;
  /** Mensaje que recibe el cliente cuando el MIME no esta permitido. */
  invalidTypeMessage: string;
}

/**
 * Divide una ruta publica canonica (`/uploads/<carpeta>/<archivo>`) en
 * segmentos seguros. Devuelve `null` ante cualquier forma que pueda escapar de
 * `UPLOAD_DIR`: prefijo distinto, `..`, `.`, segmentos vacios, separadores
 * invertidos, unidades de Windows o bytes nulos.
 */
function parseUploadSegments(publicPath: string): string[] | null {
  if (typeof publicPath !== 'string' || !publicPath.startsWith(UPLOAD_URL_PREFIX)) {
    return null;
  }

  if (publicPath.includes('\0') || publicPath.includes('\\')) {
    return null;
  }

  const relative = publicPath.slice(UPLOAD_URL_PREFIX.length);
  if (!relative) {
    return null;
  }

  const segments = relative.split('/');

  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..' || segment.includes(':')) {
      return null;
    }
  }

  return segments;
}

/** Crea el subdirectorio indicado dentro de `UPLOAD_DIR` de forma asincrona. */
export async function ensureUploadDirectory(folder?: string): Promise<string> {
  if (folder !== undefined && !/^[A-Za-z0-9_-]+$/.test(folder)) {
    throw new Error(`Carpeta de uploads invalida: ${folder}`);
  }

  const directory = folder ? path.join(env.UPLOAD_DIR, folder) : env.UPLOAD_DIR;
  await fs.promises.mkdir(directory, { recursive: true });
  return directory;
}

/**
 * Comprueba si una ruta publica es canonica y, opcionalmente, si pertenece a la
 * carpeta indicada. Se usa como validacion de entrada antes de persistir una
 * ruta y como defensa adicional al resolverla en disco.
 */
export function isUploadPublicPath(publicPath: string, folder?: string): boolean {
  const segments = parseUploadSegments(publicPath);

  if (!segments) {
    return false;
  }

  if (!folder) {
    return true;
  }

  return segments.length === 2 && segments[0] === folder;
}

/**
 * Convierte una URL publica (`/uploads/...`) en su ruta absoluta en disco.
 * La base de datos guarda rutas publicas; esta es la unica traduccion al
 * sistema de archivos. Rechaza cualquier ruta que no quede contenida en
 * `UPLOAD_DIR`.
 */
export function resolveUploadPath(publicPath: string): string {
  const segments = parseUploadSegments(publicPath);

  if (!segments) {
    throw new HttpError(400, 'Ruta de archivo inválida');
  }

  const uploadRoot = path.resolve(env.UPLOAD_DIR);
  const absolutePath = path.resolve(uploadRoot, ...segments);
  const relativePath = path.relative(uploadRoot, absolutePath);

  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new HttpError(400, 'Ruta de archivo inválida');
  }

  return absolutePath;
}

/**
 * Elimina un archivo subido si existe. Las rutas vacias o invalidas se ignoran
 * con una advertencia para que una fila corrupta no pueda borrar archivos fuera
 * de `UPLOAD_DIR` ni impedir la eliminacion del registro.
 */
export async function deleteUploadIfExists(
  publicPath: string | null | undefined
): Promise<boolean> {
  if (!publicPath) {
    return false;
  }

  let absolutePath: string;

  try {
    absolutePath = resolveUploadPath(publicPath);
  } catch {
    console.warn(`Ruta de archivo invalida, no se elimina: ${publicPath}`);
    return false;
  }

  try {
    await fs.promises.unlink(absolutePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/**
 * Fabrica unica de subidores Multer. Centraliza el almacenamiento en disco, la
 * creacion asincrona del directorio, el nombre UUID y el filtro de tipos para
 * que canciones e imagenes solo declaren sus diferencias legitimas.
 */
export function createUploader(options: CreateUploaderOptions) {
  const { folder, allowedMimeTypes, maxFileSize, invalidTypeMessage } = options;

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      const directory = path.join(env.UPLOAD_DIR, folder);
      fs.promises
        .mkdir(directory, { recursive: true })
        .then(() => cb(null, directory))
        .catch((error: Error) => cb(error, directory));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: maxFileSize,
    },
    fileFilter: (_req, file, cb) => {
      const allowed = Array.isArray(allowedMimeTypes)
        ? allowedMimeTypes.includes(file.mimetype)
        : allowedMimeTypes(file.mimetype);

      if (allowed) {
        cb(null, true);
        return;
      }

      cb(new Error(invalidTypeMessage));
    },
  });
}
