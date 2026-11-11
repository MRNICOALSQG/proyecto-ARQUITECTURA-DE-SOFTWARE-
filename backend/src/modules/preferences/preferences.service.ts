import * as preferencesRepository from './preferences.repository';
import type { PreferencesInput, UserPreferences } from './preferences.repository';

/**
 * Valores que la API devuelve cuando el usuario aun no tiene fila en
 * `user_preferences`. Son los mismos defaults del esquema, pero la aplicacion
 * los define en un unico lugar para no repetirlos en el router ni en otros
 * modulos.
 */
export const DEFAULT_PREFERENCES = {
  background_type: 'solid',
  background_value: '#131315',
  hud_color: '#00dbe9',
  hud_opacity: 0.8,
  particles_type: 'none',
  particles_color: 'white',
  particles_speed: 1,
  particles_opacity: 0.5,
  background_size: 'cover',
  background_position: 'center',
  background_repeat: 'no-repeat',
} as const;

export type DefaultPreferences = typeof DEFAULT_PREFERENCES;

export async function getPreferences(
  userId: string
): Promise<UserPreferences | DefaultPreferences> {
  const stored = await preferencesRepository.findByUserId(userId);
  return stored ?? { ...DEFAULT_PREFERENCES };
}

export function updatePreferences(
  userId: string,
  input: PreferencesInput
): Promise<UserPreferences> {
  return preferencesRepository.upsert(userId, input);
}
