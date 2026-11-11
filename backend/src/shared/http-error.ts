/**
 * Error de aplicacion con un codigo HTTP asociado.
 *
 * Permite que servicios y controladores expresen fallos esperados (validacion,
 * recurso inexistente, conflicto) sin acoplarse a Express. El controlador decide
 * como se traduce finalmente a una respuesta HTTP.
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}
