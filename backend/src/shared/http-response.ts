import { Response } from 'express';

/**
 * Envia una respuesta de error con el formato `{ error }` usado por la API.
 *
 * Solo se usa donde ya no es posible delegar al middleware central: el
 * streaming de audio responde directamente cuando las cabeceras ya se enviaron.
 */
export function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}
