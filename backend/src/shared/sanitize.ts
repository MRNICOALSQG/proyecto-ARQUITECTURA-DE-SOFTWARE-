import { z } from 'zod';

// Caracteres que la API elimina del texto libre antes de persistirlo. Se
// centraliza aqui para que canciones, playlists y perfil apliquen la misma regla.
const UNSAFE_CHARACTERS = /[<>;"'&]/g;

export function sanitizeText(value: string): string {
  return value.replace(UNSAFE_CHARACTERS, '');
}

export interface CleanTextSchemaOptions {
  /** Mensaje cuando el campo falta o no es una cadena. */
  requiredMessage: string;
  /** Longitud minima despues de sanear y recortar espacios. */
  min: number;
  /** Longitud maxima despues de sanear y recortar espacios. */
  max: number;
  /** Mensaje para la longitud minima; por defecto usa `requiredMessage`. */
  minMessage?: string;
  /** Mensaje para la longitud maxima. */
  maxMessage?: string;
}

/**
 * Esquema Zod para texto libre: valida el tipo, aplica `sanitizeText`, recorta
 * espacios y solo despues comprueba longitud. Asi valores como `"<>"` o cadenas
 * de espacios se rechazan en lugar de persistirse vacios.
 */
export function cleanTextSchema(options: CleanTextSchemaOptions) {
  const { requiredMessage, min, max, minMessage, maxMessage } = options;

  return z
    .string({
      required_error: requiredMessage,
      invalid_type_error: requiredMessage,
    })
    .transform((value) => sanitizeText(value).trim())
    .pipe(
      z
        .string()
        .min(min, minMessage ?? requiredMessage)
        .max(max, maxMessage ?? `El texto no puede superar los ${max} caracteres`)
    );
}
