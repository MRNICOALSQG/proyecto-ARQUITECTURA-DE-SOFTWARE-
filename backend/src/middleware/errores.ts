import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { HttpError } from '../shared/http-error';
import { logServerError } from '../shared/logger';
import { UploadFileTypeError } from '../shared/uploads';

interface TranslatedError {
  status: number;
  message: string;
}

interface StatusError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  expose?: boolean;
  code?: string;
}

const MULTER_MESSAGES: Record<string, string> = {
  LIMIT_FILE_COUNT: 'Se superó el número máximo de archivos',
  LIMIT_PART_COUNT: 'El formulario contiene demasiadas partes',
  LIMIT_FIELD_KEY: 'El nombre de un campo es demasiado largo',
  LIMIT_FIELD_VALUE: 'El valor de un campo es demasiado largo',
  LIMIT_FIELD_COUNT: 'El formulario contiene demasiados campos',
  LIMIT_UNEXPECTED_FILE: 'Campo de archivo inesperado',
  MISSING_FIELD_NAME: 'Falta el nombre del archivo',
};

function translateZodError(error: ZodError): TranslatedError {
  return {
    status: 400,
    message: error.issues[0]?.message ?? 'Solicitud inválida',
  };
}

function translateMulterError(error: multer.MulterError): TranslatedError {
  if (error.code === 'LIMIT_FILE_SIZE') {
    // `createUploader` anota el limite exacto (50MB audio / 5MB imagen).
    return {
      status: 400,
      message: /MB/.test(error.message)
        ? error.message
        : 'El archivo excede el tamaño máximo permitido',
    };
  }

  return {
    status: 400,
    message: MULTER_MESSAGES[error.code] ?? 'Solicitud de subida inválida',
  };
}

function asBodyParserError(error: unknown): StatusError | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const candidate = error as StatusError;
  const bodyParserTypes = new Set([
    'entity.parse.failed',
    'entity.too.large',
    'encoding.unsupported',
    'charset.unsupported',
    'request.aborted',
    'request.size.invalid',
  ]);

  return candidate.type && bodyParserTypes.has(candidate.type) ? candidate : null;
}

function translateBodyParserError(error: StatusError): TranslatedError {
  switch (error.type) {
    case 'entity.parse.failed':
      return { status: 400, message: 'JSON inválido' };
    case 'entity.too.large':
      return { status: 413, message: 'El cuerpo de la solicitud es demasiado grande' };
    case 'encoding.unsupported':
    case 'charset.unsupported':
      return { status: 415, message: 'Codificación no soportada' };
    default:
      return { status: 400, message: 'Solicitud inválida' };
  }
}

function isInvalidUuidDatabaseError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === '22P02'
  );
}

function translateError(error: unknown): TranslatedError {
  if (error instanceof UploadFileTypeError) {
    return { status: 400, message: error.message };
  }

  if (error instanceof ZodError) {
    return translateZodError(error);
  }

  if (error instanceof multer.MulterError) {
    return translateMulterError(error);
  }

  if (error instanceof HttpError) {
    return { status: error.status, message: error.message };
  }

  const bodyParserError = asBodyParserError(error);
  if (bodyParserError) {
    return translateBodyParserError(bodyParserError);
  }

  // Defensa adicional: aunque las rutas validan UUID con Zod, un identificador
  // invalido que llegue a PostgreSQL no debe convertirse en un 500.
  if (isInvalidUuidDatabaseError(error)) {
    return { status: 400, message: 'Identificador inválido' };
  }

  return { status: 500, message: 'Error interno del servidor' };
}

/**
 * Middleware central de errores de la API.
 *
 * Traduce errores conocidos (dominio, Zod, Multer, body-parser) y responde 500
 * generico ante cualquier fallo inesperado. Los 5xx se registran en una sola
 * linea JSON; los 4xx esperados no generan ruido en los logs.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent || res.writableEnded || res.destroyed) {
    next(err);
    return;
  }

  const translated = translateError(err);

  if (translated.status >= 500) {
    logServerError(req, translated.status, err);
  }

  res.status(translated.status).json({ error: translated.message });
}
