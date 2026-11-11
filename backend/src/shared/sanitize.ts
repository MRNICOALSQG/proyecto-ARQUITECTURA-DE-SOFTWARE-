// Caracteres que la API elimina del texto libre antes de persistirlo. Se
// centraliza aqui para que canciones, playlists y perfil apliquen la misma regla.
const UNSAFE_CHARACTERS = /[<>;"'&]/g;

export function sanitizeText(value: string): string {
  return value.replace(UNSAFE_CHARACTERS, '');
}
