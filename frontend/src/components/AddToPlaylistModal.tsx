import { useState, useEffect } from 'react';
import { X, ListMusic } from 'lucide-react';
import { api } from '../api/client';
import type { Song } from '../stores/playerStore';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
}

export function AddToPlaylistModal({ isOpen, onClose, song }: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get('/playlists').then(res => setPlaylists(res.data.playlists)).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen || !song) return null;

  const handleAddToPlaylist = async (playlistId: string) => {
    try {
      setLoading(true);
      await api.post(`/playlists/${playlistId}/songs`, { song_id: song.id });
      onClose();
    } catch (error) {
      console.error('Error adding to playlist:', error);
      alert('Error añadiendo a la playlist');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-sm p-6 rounded-2xl relative shadow-2xl border border-white/10">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-white/5"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-headline-md text-xl text-on-surface mb-6 flex items-center gap-2">
          <ListMusic className="w-5 h-5 text-primary" /> Añadir a Playlist
        </h2>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {playlists.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-4">No tienes playlists creadas aún.</p>
          ) : (
            playlists.map(pl => (
              <button
                key={pl.id}
                onClick={() => handleAddToPlaylist(pl.id)}
                disabled={loading}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded overflow-hidden bg-surface-variant flex items-center justify-center shrink-0">
                  {pl.cover_url ? (
                    <img src={pl.cover_url} alt={pl.name} className="w-full h-full object-cover" />
                  ) : (
                    <ListMusic className="w-5 h-5 text-primary" />
                  )}
                </div>
                <span className="text-sm text-on-surface font-body-md truncate">{pl.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
