import { Response } from 'express';
import { HttpError } from './http-error';

interface FallbackError {
  status: number;
  message: string;
  logLabel?: string;
}

/** Envia una respuesta de error con el formato `{ error }` usado por la API. */
export function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

/**
 * Traduce un error del servicio a una respuesta HTTP.
 *
 * Los `HttpError` conservan su codigo y mensaje sin registrarse como fallos
 * internos. Cualquier otro error se registra con `logLabel`, si se indica, y se
 * responde con el mensaje generico provisto por el controlador.
 */
export function sendControllerError(
  res: Response,
  error: unknown,
  fallback: FallbackError
): void {
  if (error instanceof HttpError) {
    sendError(res, error.status, error.message);
    return;
  }

  if (fallback.logLabel) {
    console.error(fallback.logLabel, error);
  }

  sendError(res, fallback.status, fallback.message);
}
