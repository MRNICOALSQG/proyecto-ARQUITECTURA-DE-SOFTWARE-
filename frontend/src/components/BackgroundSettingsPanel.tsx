import { X, Image as ImageIcon, Sparkles, Upload, Check, Move } from 'lucide-react';
import { usePreferencesStore } from '../stores/preferencesStore';
import { useState } from 'react';
import { api, getImageUrl } from '../api/client';

export function BackgroundSettingsPanel() {
  const { preferences, updatePreferences, applyPreferences, isBackgroundSettingsOpen, setIsBackgroundSettingsOpen } = usePreferencesStore();
  const [loading, setLoading] = useState(false);

  if (!isBackgroundSettingsOpen) return null;

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updatePreferences({ background_value: res.data.url, background_type: 'image' });
    } catch (err) {
      console.error(err);
      alert('Error subiendo imagen de fondo');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    await applyPreferences();
    setIsBackgroundSettingsOpen(false);
  };

  const particleColors = [
    { value: 'white', label: 'Blanco', hex: '#ffffff' },
    { value: 'red', label: 'Rojo', hex: '#ef4444' },
    { value: 'violet', label: 'Violeta', hex: '#a855f7' },
    { value: 'pink', label: 'Rosa', hex: '#ec4899' },
    { value: 'green', label: 'Verde', hex: '#22c55e' },
    { value: 'yellow', label: 'Amarillo', hex: '#eab308' },
    { value: 'blue', label: 'Azul', hex: '#3b82f6' },
    { value: 'orange', label: 'Naranja', hex: '#f97316' },
  ];

  const sizeOptions = [
    { value: 'cover', label: 'Cubrir' },
    { value: 'contain', label: 'Contener' },
    { value: '100% 100%', label: 'Estirar' },
    { value: 'auto', label: 'Original' },
  ];

  const positionOptions = [
    { value: 'center', label: 'Centro' },
    { value: 'top', label: 'Arriba' },
    { value: 'bottom', label: 'Abajo' },
    { value: 'left', label: 'Izquierda' },
    { value: 'right', label: 'Derecha' },
    { value: 'top left', label: '↖ Arriba Izq' },
    { value: 'top right', label: '↗ Arriba Der' },
    { value: 'bottom left', label: '↙ Abajo Izq' },
    { value: 'bottom right', label: '↘ Abajo Der' },
  ];

  const isImageBg = preferences.background_type === 'image' && preferences.background_value && !preferences.background_value.startsWith('#');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md p-6 rounded-2xl relative shadow-[0_0_50px_rgba(0,0,0,0.5)] max-h-[90vh] overflow-y-auto">
        <button 
          onClick={() => setIsBackgroundSettingsOpen(false)}
          className="absolute top-4 right-4 p-2 text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-white/5"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-headline-md text-2xl text-on-surface mb-6">Configuración de Fondo</h2>

        <div className="space-y-6">
          {/* Background Type */}
          <div>
            <h3 className="font-label-sm text-xs text-on-surface-variant mb-3 uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Imagen de Fondo
            </h3>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => updatePreferences({ background_type: 'solid', background_value: '#131315' })}
                className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                  preferences.background_type === 'solid'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-white/10 text-on-surface-variant hover:border-white/30'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-surface-container border border-white/20" />
                <span className="font-label-sm text-xs">Color Sólido</span>
              </button>
              
              <label
                className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  preferences.background_type === 'image'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-white/10 text-on-surface-variant hover:border-white/30'
                } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary border border-white/20 flex items-center justify-center">
                  <Upload className="w-4 h-4 text-white" />
                </div>
                <span className="font-label-sm text-xs">{loading ? 'Subiendo...' : 'Subir Imagen'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleBgImageUpload} />
              </label>
            </div>

            {preferences.background_type === 'solid' && (
              <div className="flex gap-3">
                <input
                  type="color"
                  value={preferences.background_value.startsWith('#') ? preferences.background_value : '#131315'}
                  onChange={(e) => updatePreferences({ background_value: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0"
                />
                <input
                  type="text"
                  value={preferences.background_value}
                  onChange={(e) => updatePreferences({ background_value: e.target.value })}
                  className="flex-1 bg-surface-container border border-white/10 rounded-lg px-3 text-sm text-on-surface focus:outline-none focus:border-primary/50"
                />
              </div>
            )}

            {/* Image Preview + Framing Controls */}
            {isImageBg && (
              <div className="space-y-4 mt-3">
                <div className="rounded-lg overflow-hidden border border-white/10 h-32 relative">
                  <img 
                    src={getImageUrl(preferences.background_value)} 
                    alt="Background preview" 
                    className="w-full h-full"
                    style={{
                      objectFit: (preferences.background_size === 'cover' ? 'cover' : preferences.background_size === 'contain' ? 'contain' : 'fill') as any,
                      objectPosition: preferences.background_position || 'center',
                    }}
                  />
                  <label className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-xs text-white flex items-center gap-1 cursor-pointer hover:bg-black/80 transition-colors">
                    <Upload className="w-3 h-3" /> Cambiar
                    <input type="file" accept="image/*" className="hidden" onChange={handleBgImageUpload} />
                  </label>
                </div>

                <div>
                  <h4 className="font-label-sm text-xs text-on-surface-variant mb-2 uppercase tracking-wider flex items-center gap-1">
                    <Move className="w-3 h-3" /> Encuadre de la Imagen
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1 block">Tamaño</label>
                      <select
                        value={preferences.background_size || 'cover'}
                        onChange={(e) => updatePreferences({ background_size: e.target.value })}
                        className="w-full bg-surface-container border border-white/10 rounded px-2 py-1.5 text-sm focus:outline-none text-on-surface"
                      >
                        {sizeOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1 block">Posición</label>
                      <select
                        value={preferences.background_position || 'center'}
                        onChange={(e) => updatePreferences({ background_position: e.target.value })}
                        className="w-full bg-surface-container border border-white/10 rounded px-2 py-1.5 text-sm focus:outline-none text-on-surface"
                      >
                        {positionOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Opacity */}
          <div>
            <h3 className="font-label-sm text-xs text-on-surface-variant mb-3 uppercase tracking-wider">
              Opacidad de la Interfaz
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-on-surface-variant">0%</span>
              <input 
                type="range" 
                min="0" max="1" step="0.1" 
                value={preferences.hud_opacity ?? 0.8}
                onChange={(e) => updatePreferences({ hud_opacity: parseFloat(e.target.value) })}
                className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
              />
              <span className="text-xs text-on-surface-variant">100%</span>
            </div>
          </div>

          {/* Particles */}
          <div>
            <h3 className="font-label-sm text-xs text-on-surface-variant mb-3 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Efectos de Partículas
            </h3>
            
            <select 
              value={preferences.particles_type || 'none'}
              onChange={(e) => updatePreferences({ particles_type: e.target.value as any })}
              className="w-full bg-surface-container border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none mb-3"
            >
              <option value="none">Ninguno</option>
              <option value="snow">Copos de Nieve</option>
              <option value="particles">Partículas</option>
              <option value="dots">Puntos Flotantes</option>
              <option value="lines">Líneas Animadas</option>
            </select>

            {preferences.particles_type && preferences.particles_type !== 'none' && (
              <div className="space-y-3 mt-4 bg-black/20 p-3 rounded-lg border border-white/5">
                <div>
                  <label className="text-xs text-on-surface-variant mb-2 block">Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {particleColors.map(c => (
                      <button
                        key={c.value}
                        onClick={() => updatePreferences({ particles_color: c.value })}
                        className={`w-7 h-7 rounded-full transition-all ${
                          preferences.particles_color === c.value
                            ? 'ring-2 ring-white ring-offset-1 ring-offset-surface scale-110'
                            : 'hover:scale-105 border border-white/20'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      >
                        {preferences.particles_color === c.value && (
                          <Check className="w-3.5 h-3.5 text-black mx-auto drop-shadow" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-on-surface-variant mb-1 block">Velocidad: {(preferences.particles_speed || 1).toFixed(1)}x</label>
                  <input 
                    type="range" min="0.1" max="3" step="0.1" 
                    value={preferences.particles_speed || 1}
                    onChange={(e) => updatePreferences({ particles_speed: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-white/10 rounded-full appearance-none accent-primary"
                  />
                </div>

                <div>
                  <label className="text-xs text-on-surface-variant mb-1 block">Opacidad: {(preferences.particles_opacity || 0.5).toFixed(1)}</label>
                  <input 
                    type="range" min="0.1" max="1" step="0.1" 
                    value={preferences.particles_opacity || 0.5}
                    onChange={(e) => updatePreferences({ particles_opacity: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-white/10 rounded-full appearance-none accent-primary"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleApply}
            className="w-full py-3 mt-6 rounded-full bg-primary text-on-primary font-bold shadow-[0_0_15px_rgba(0,219,233,0.3)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            Aplicar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
