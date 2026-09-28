import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../api/client';

export interface Preferences {
  hud_color: string;
  background_type: 'solid' | 'image';
  background_value: string;
  hud_opacity: number;
  particles_type: 'none' | 'snow' | 'particles' | 'dots' | 'lines';
  particles_color: string;
  particles_speed: number;
  particles_opacity: number;
  background_size: string;
  background_position: string;
  background_repeat: string;
}

interface PreferencesState {
  preferences: Preferences;
  isHudOpen: boolean;
  isBackgroundSettingsOpen: boolean;
  setIsHudOpen: (open: boolean) => void;
  setIsBackgroundSettingsOpen: (open: boolean) => void;
  fetchPreferences: () => Promise<void>;
  updatePreferences: (prefs: Partial<Preferences>) => Promise<void>;
  applyPreferences: () => Promise<void>;
}

const defaultPreferences: Preferences = {
  hud_color: '#00dbe9',
  background_type: 'solid',
  background_value: '#131315',
  hud_opacity: 0.8,
  particles_type: 'none',
  particles_color: 'white',
  particles_speed: 1,
  particles_opacity: 0.5,
  background_size: 'cover',
  background_position: 'center',
  background_repeat: 'no-repeat',
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      preferences: defaultPreferences,
      isHudOpen: false,
      isBackgroundSettingsOpen: false,
      setIsHudOpen: (isHudOpen) => set({ isHudOpen }),
      setIsBackgroundSettingsOpen: (isBackgroundSettingsOpen) => set({ isBackgroundSettingsOpen }),
      fetchPreferences: async () => {
        try {
          const res = await api.get('/preferences');
          if (res.data && res.data.preferences) {
            const merged = { ...defaultPreferences, ...res.data.preferences };
            set({ preferences: merged });
          }
        } catch (err) {
          console.error('Error fetching preferences:', err);
        }
      },
      updatePreferences: async (prefs) => {
        const newPrefs = { ...get().preferences, ...prefs };
        set({ preferences: newPrefs });
      },
      applyPreferences: async () => {
        try {
          await api.put('/preferences', get().preferences);
        } catch (err) {
          console.error('Error saving preferences:', err);
        }
      }
    }),
    { name: 'rinne-preferences', partialize: (state) => ({ preferences: state.preferences }) }
  )
);
