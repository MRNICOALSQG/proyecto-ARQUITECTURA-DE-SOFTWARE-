import '../helpers/env';
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import multer from 'multer';
import { z } from 'zod';
import { errorHandler } from '../../src/middleware/errores';
import { HttpError, NoEncontrado } from '../../src/shared/http-error';
import { UploadFileTypeError } from '../../src/shared/uploads';

interface FakeResponse {
  statusCode: number;
  body: unknown;
  headersSent: boolean;
  writableEnded: boolean;
  destroyed: boolean;
  status: (code: number) => FakeResponse;
  json: (body: unknown) => FakeResponse;
}

function createResponse(): FakeResponse {
  return {
    statusCode: 0,
    body: undefined,
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      this.writableEnded = true;
      return this;
    },
  };
}

const request = {
  method: 'GET',
  originalUrl: '/api/songs?token=very-secret-jwt-value',
  headers: {},
} as never;

describe('middleware central de errores', () => {
  const originalConsoleError = console.error;
  let logs: string[] = [];

  afterEach(() => {
    console.error = originalConsoleError;
    logs = [];
  });

  function captureLogs(): void {
    logs = [];
    console.error = (...args: unknown[]) => {
      logs.push(args.map((value) => String(value)).join(' '));
    };
  }

  it('traduce un ZodError a 400 con el primer mensaje', () => {
    const response = createResponse();
    const next = () => assert.fail('next no debe invocarse');
    const schema = z.object({ email: z.string().email('Email no válido') });

    let error: unknown;
    try {
      schema.parse({ email: 'no-es-email' });
    } catch (caught) {
      error = caught;
    }

    errorHandler(error, request, response as never, next);

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, { error: 'Email no válido' });
    assert.equal(logs.length, 0);
  });

  it('respeta el status de HttpError y NoEncontrado', () => {
    const forbidden = createResponse();
    errorHandler(new HttpError(403, 'Prohibido'), request, forbidden as never, () => {});

    assert.equal(forbidden.statusCode, 403);
    assert.deepEqual(forbidden.body, { error: 'Prohibido' });

    const missing = createResponse();
    errorHandler(new NoEncontrado('No existe'), request, missing as never, () => {});

    assert.equal(missing.statusCode, 404);
    assert.deepEqual(missing.body, { error: 'No existe' });
    assert.equal(logs.length, 0);
  });

  it('traduce errores de body-parser a 400 y 413', () => {
    const parseError = Object.assign(new Error('Unexpected token'), {
      type: 'entity.parse.failed',
    });
    const parseResponse = createResponse();
    errorHandler(parseError, request, parseResponse as never, () => {});
    assert.equal(parseResponse.statusCode, 400);
    assert.deepEqual(parseResponse.body, { error: 'JSON inválido' });

    const largeError = Object.assign(new Error('too large'), { type: 'entity.too.large' });
    const largeResponse = createResponse();
    errorHandler(largeError, request, largeResponse as never, () => {});
    assert.equal(largeResponse.statusCode, 413);
    assert.deepEqual(largeResponse.body, {
      error: 'El cuerpo de la solicitud es demasiado grande',
    });
  });

  it('traduce el codigo PostgreSQL 22P02 a 400', () => {
    const response = createResponse();
    errorHandler(
      Object.assign(new Error('invalid input syntax for type uuid'), { code: '22P02' }),
      request,
      response as never,
      () => {}
    );

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, { error: 'Identificador inválido' });
  });

  it('traduce UploadFileTypeError y MulterError a 400', () => {
    const typeResponse = createResponse();
    errorHandler(
      new UploadFileTypeError('Formato no permitido'),
      request,
      typeResponse as never,
      () => {}
    );
    assert.equal(typeResponse.statusCode, 400);
    assert.deepEqual(typeResponse.body, { error: 'Formato no permitido' });

    const sizeError = new multer.MulterError('LIMIT_FILE_SIZE', 'image');
    sizeError.message = 'El archivo excede el tamaño máximo de 5MB';
    const sizeResponse = createResponse();
    errorHandler(sizeError, request, sizeResponse as never, () => {});
    assert.equal(sizeResponse.statusCode, 400);
    assert.deepEqual(sizeResponse.body, {
      error: 'El archivo excede el tamaño máximo de 5MB',
    });

    const fieldError = new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'archivo');
    const fieldResponse = createResponse();
    errorHandler(fieldError, request, fieldResponse as never, () => {});
    assert.equal(fieldResponse.statusCode, 400);
    assert.deepEqual(fieldResponse.body, { error: 'Campo de archivo inesperado' });
  });

  it('responde 500 generico y registra una sola linea JSON sin el token', () => {
    captureLogs();
    const response = createResponse();

    errorHandler(new Error('fallo interno'), request, response as never, () => {});

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { error: 'Error interno del servidor' });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].includes('\n'), false);

    const record = JSON.parse(logs[0]);
    assert.equal(record.level, 'error');
    assert.equal(record.status, 500);
    assert.equal(record.method, 'GET');
    assert.equal(record.path, '/api/songs');
    assert.equal(record.message, 'fallo interno');
    assert.equal(typeof record.stack, 'string');
    assert.equal(logs[0].includes('very-secret-jwt-value'), false);
    assert.equal(JSON.stringify(response.body).includes('stack'), false);
  });

  it('no registra errores 4xx', () => {
    captureLogs();
    const response = createResponse();

    errorHandler(new HttpError(400, 'Solicitud inválida'), request, response as never, () => {});

    assert.equal(response.statusCode, 400);
    assert.equal(logs.length, 0);
  });

  it('delega en next cuando las cabeceras ya se enviaron', () => {
    captureLogs();
    const response = createResponse();
    response.headersSent = true;
    const error = new Error('fallo posterior');
    let forwarded: unknown;

    errorHandler(error, request, response as never, (caught) => {
      forwarded = caught;
    });

    assert.equal(forwarded, error);
    assert.equal(response.statusCode, 0);
    assert.equal(response.body, undefined);
    assert.equal(logs.length, 0);
  });
});
