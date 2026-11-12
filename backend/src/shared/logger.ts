import { Request } from 'express';

/**
 * Registra un fallo interno como una unica linea JSON.
 *
 * Docker recoge `stderr`, por lo que el registro aparece en
 * `docker compose logs api` y puede filtrarse con `grep '"status":500'`.
 * El stack solo viaja al log, nunca a la respuesta HTTP.
 *
 * Se registra `req.originalUrl` sin la query string y no la URL completa: la
 * query puede contener credenciales (por ejemplo el JWT que el frontend envia
 * en `?token=` para el streaming de audio) y no debe quedar en los logs.
 * No se usa `req.path` porque, cuando el error sale de un router montado,
 * Express ya recorto el prefijo de montaje (por ejemplo `/api/songs`).
 */
export function logServerError(req: Request, status: number, error: unknown): void {
  const record: Record<string, unknown> = {
    level: 'error',
    time: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl.split('?')[0],
    status,
    message: error instanceof Error ? error.message : String(error),
  };

  if (error instanceof Error && error.stack) {
    record.stack = error.stack;
  }

  console.error(JSON.stringify(record));
}
