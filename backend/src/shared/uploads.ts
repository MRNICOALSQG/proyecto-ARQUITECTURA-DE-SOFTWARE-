import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

/**
 * Convierte una URL publica (`/uploads/...`) en su ruta absoluta en disco.
 * La base de datos guarda rutas publicas; esta es la unica traduccion al
 * sistema de archivos.
 */
export function resolveUploadPath(publicPath: string): string {
  return path.resolve(publicPath.replace('/uploads/', `${env.UPLOAD_DIR}/`));
}

/** Elimina un archivo subido si existe; ignora rutas vacias. */
export function deleteUploadIfExists(publicPath: string | null | undefined): void {
  if (!publicPath) {
    return;
  }

  const absolutePath = resolveUploadPath(publicPath);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}
