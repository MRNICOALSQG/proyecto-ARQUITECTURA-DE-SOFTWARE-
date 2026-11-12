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

/** Error de dominio para recursos inexistentes. El middleware lo traduce a 404. */
export class NoEncontrado extends HttpError {
  constructor(message: string) {
    super(404, message);
    this.name = 'NoEncontrado';
  }
}
