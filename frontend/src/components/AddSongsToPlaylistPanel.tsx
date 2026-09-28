import { useState, useEffect } from 'react';
import { X, Plus, Music as MusicIcon, Check } from 'lucide-react';
import { api, getImageUrl } from '../api/client';
import type { Song } from '../stores/playerStore';

interface AddSongsToPlaylistPanelProps {
  isOpen: boolean;
  onClose: () => void;
  playlistId: string;
  existingSongIds: string[];
  onSuccess: () => void;
}

export function AddSongsToPlaylistPanel({ isOpen, onClose, playlistId, existingSongIds, onSuccess }: AddSongsToPlaylistPanelProps) {
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      setLoading(true);
      api.get('/songs')
        .then(res => setAllSongs(res.data.songs))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const availableSongs = allSongs.filter(s => !existingSongIds.includes(s.id));

  const toggleSong = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      for (const songId of selectedIds) {
        await api.post(`/playlists/${playlistId}/songs`, { song_id: songId });
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error añadiendo canciones');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-sm max-h-[80vh] rounded-2xl relative shadow-2xl border border-white/10 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <h3 className="font-headline-md text-lg text-on-surface flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Añadir Canciones
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Song List */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {loading ? (
            <p className="text-sm text-on-surface-variant text-center py-8">Cargando canciones...</p>
          ) : availableSongs.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-8">No hay canciones disponibles para añadir.</p>
          ) : (
            availableSongs.map(song => {
              const isSelected = selectedIds.has(song.id);
              return (
                <button
                  key={song.id}
                  onClick={() => toggleSong(song.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                    isSelected
                      ? 'bg-primary/15 border border-primary/30'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="w-10 h-10 rounded overflow-hidden bg-surface-variant flex items-center justify-center shrink-0">
                    {song.cover_path ? (
                      <img src={getImageUrl(song.cover_path)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <MusicIcon className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-on-surface truncate">{song.title}</p>
                    <p className="text-xs text-on-surface-variant truncate">{song.artist}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSelected
                      ? 'bg-primary border-primary'
                      : 'border-white/20'
                  }`}>
                    {isSelected && <Check className="w-4 h-4 text-black" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        {selectedIds.size > 0 && (
          <div className="p-4 border-t border-white/10 shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-full bg-primary text-on-primary font-bold shadow-[0_0_15px_rgba(0,219,233,0.3)] hover:scale-[1.02] transition-all disabled:opacity-50"
            >
              {saving ? 'Guardando...' : `Añadir ${selectedIds.size} canción${selectedIds.size > 1 ? 'es' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
