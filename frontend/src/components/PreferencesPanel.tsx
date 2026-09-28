import { X, Check } from 'lucide-react';
import { usePreferencesStore } from '../stores/preferencesStore';

export function PreferencesPanel() {
  const { preferences, updatePreferences, applyPreferences, isHudOpen, setIsHudOpen } = usePreferencesStore();

  if (!isHudOpen) return null;

  const handleColorChange = (color: string) => {
    updatePreferences({ hud_color: color });
  };

  const handleApply = async () => {
    await applyPreferences();
    setIsHudOpen(false);
  };

  const colors = [
    { value: '#ff4444', label: 'Rojo' },
    { value: '#ffffff', label: 'Blanco' },
    { value: '#b388ff', label: 'Violeta' },
    { value: '#ff80ab', label: 'Rosa' },
    { value: '#69f0ae', label: 'Verde' },
    { value: '#ffff00', label: 'Amarillo' },
    { value: '#00dbe9', label: 'Azul' },
    { value: '#ffab40', label: 'Naranja' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md p-6 rounded-2xl relative">
        <button 
          onClick={() => setIsHudOpen(false)}
          className="absolute top-4 right-4 p-2 text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-white/5"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-headline-md text-2xl text-on-surface mb-6">Configuración del HUD</h2>

        <div className="space-y-6">
          {/* HUD Color */}
          <div>
            <h3 className="font-label-sm text-xs text-on-surface-variant mb-3 uppercase tracking-wider">Color del HUD</h3>
            <div className="flex gap-3 flex-wrap">
              {colors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => handleColorChange(color.value)}
                  className={`w-10 h-10 rounded-full transition-all relative ${preferences.hud_color === color.value ? 'ring-2 ring-white ring-offset-2 ring-offset-surface scale-110' : 'hover:scale-105 border border-white/20'}`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                >
                  {preferences.hud_color === color.value && (
                    <Check className="w-5 h-5 text-black absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-lg" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <h3 className="font-label-sm text-xs text-on-surface-variant mb-3 uppercase tracking-wider">Vista Previa</h3>
            <div className="flex items-center gap-4 p-4 rounded-lg bg-black/30 border border-white/5">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: preferences.hud_color }}>
                <span className="text-black text-xl font-bold">R</span>
              </div>
              <div>
                <p className="font-bold" style={{ color: preferences.hud_color }}>Rin'ne</p>
                <p className="text-xs text-on-surface-variant">Vista previa del color</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleApply}
            className="w-full py-3 mt-6 rounded-full font-bold shadow-[0_0_15px_rgba(0,219,233,0.3)] hover:scale-[1.02] transition-all text-black"
            style={{ backgroundColor: preferences.hud_color }}
          >
            Aplicar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
