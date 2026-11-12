import { Request } from 'express';

/**
 * Registra un fallo interno como una unica linea JSON.
 *
 * Docker recoge `stderr`, por lo que el registro aparece en
 * `docker compose logs api` y puede filtrarse con `grep '"status":500'`.
 * El stack solo viaja al log, nunca a la respuesta HTTP.
 */
export function logServerError(req: Request, status: number, error: unknown): void {
  const record: Record<string, unknown> = {
    level: 'error',
    time: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    status,
    message: error instanceof Error ? error.message : String(error),
  };

  if (error instanceof Error && error.stack) {
    record.stack = error.stack;
  }

  console.error(JSON.stringify(record));
}
