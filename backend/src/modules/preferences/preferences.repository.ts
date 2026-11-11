import { query } from '../../config/database';

export interface UserPreferences {
  user_id: string;
  background_type: string;
  background_value: string;
  hud_color: string;
  hud_opacity: number;
  particles_type: string;
  particles_color: string;
  particles_speed: number;
  particles_opacity: number;
  background_size: string;
  background_position: string;
  background_repeat: string;
  updated_at: string;
}

export interface PreferencesInput {
  background_type?: string;
  background_value?: string;
  hud_color?: string;
  hud_opacity?: number;
  particles_type?: string;
  particles_color?: string;
  particles_speed?: number;
  particles_opacity?: number;
  background_size?: string;
  background_position?: string;
  background_repeat?: string;
}

export async function findByUserId(userId: string): Promise<UserPreferences | undefined> {
  const result = await query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
  return result.rows[0];
}

export async function upsert(
  userId: string,
  input: PreferencesInput
): Promise<UserPreferences> {
  const result = await query(
    `INSERT INTO user_preferences (user_id, background_type, background_value, hud_color, hud_opacity, particles_type, particles_color, particles_speed, particles_opacity, background_size, background_position, background_repeat, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       background_type = COALESCE($2, user_preferences.background_type),
       background_value = COALESCE($3, user_preferences.background_value),
       hud_color = COALESCE($4, user_preferences.hud_color),
       hud_opacity = COALESCE($5, user_preferences.hud_opacity),
       particles_type = COALESCE($6, user_preferences.particles_type),
       particles_color = COALESCE($7, user_preferences.particles_color),
       particles_speed = COALESCE($8, user_preferences.particles_speed),
       particles_opacity = COALESCE($9, user_preferences.particles_opacity),
       background_size = COALESCE($10, user_preferences.background_size),
       background_position = COALESCE($11, user_preferences.background_position),
       background_repeat = COALESCE($12, user_preferences.background_repeat),
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      input.background_type,
      input.background_value,
      input.hud_color,
      input.hud_opacity,
      input.particles_type,
      input.particles_color,
      input.particles_speed,
      input.particles_opacity,
      input.background_size,
      input.background_position,
      input.background_repeat,
    ]
  );
  return result.rows[0];
}
