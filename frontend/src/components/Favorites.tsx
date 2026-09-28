import { useState, useEffect } from 'react';
import { Heart, ChevronLeft, ChevronRight, Music as MusicIcon, Play, Trash2 } from 'lucide-react';
import { api, getImageUrl } from '../api/client';
import { usePlayerStore, type Song } from '../stores/playerStore';

interface FavoritesProps {
  libraryOpen: boolean;
}

export function Favorites({ libraryOpen }: FavoritesProps) {
  const [favorites, setFavorites] = useState<Song[]>([]);
  const { playSong, setQueue, currentIndex } = usePlayerStore();

  const fetchFavorites = async () => {
    try {
      const res = await api.get('/favorites');
      setFavorites(res.data.songs);
    } catch (err) {
      console.error('Error fetching favorites:', err);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  const removeFavorite = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/favorites/${songId}`);
      fetchFavorites();
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  };

  const handlePlaySong = (index: number) => {
    setQueue(favorites);
    playSong(index);
  };

  return (
    <section className={`${libraryOpen ? 'w-full md:w-[450px] md:max-w-[40%] shrink-0 p-6' : 'hidden md:flex w-20 shrink-0 p-4 items-center'} h-full flex flex-col gap-6 z-10 glass-panel border-r-0 md:border-r border-white/10 overflow-x-hidden overflow-y-auto transition-all duration-300`}>
      <div className={`${libraryOpen ? 'justify-between' : 'justify-center'} flex items-center w-full shrink-0`}>
        {libraryOpen && (
          <div className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-red-400 fill-red-400" />
            <h2 className="font-headline-md text-2xl text-on-surface">Favoritas</h2>
          </div>
        )}
        {!libraryOpen && <Heart className="w-6 h-6 text-red-400 fill-red-400" />}
      </div>

      {libraryOpen && (
        <div className="flex flex-col gap-3 w-full pb-20">
          {favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-on-surface-variant gap-4 opacity-70">
              <Heart className="w-12 h-12" />
              <p className="text-sm text-center">No tienes canciones favoritas aún.<br/>Presiona el <strong>corazón</strong> en cualquier canción para agregarla.</p>
            </div>
          ) : (
            favorites.map((song, index) => (
              <div 
                key={song.id}
                onClick={() => handlePlaySong(index)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group"
              >
                <div className="w-10 h-10 rounded bg-surface-variant flex items-center justify-center text-primary shrink-0 relative overflow-hidden group/img">
                  {song.cover_path ? (
                    <img src={getImageUrl(song.cover_path)} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <MusicIcon className="w-5 h-5" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                    <Play className="w-4 h-4 text-white fill-current" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-body-md text-[16px] text-on-surface truncate">{song.title}</h4>
                  <p className="font-label-sm text-[12px] text-on-surface-variant truncate">{song.artist}</p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-all shrink-0">
                  <button
                    onClick={(e) => removeFavorite(e, song.id)}
                    className="p-1 text-red-400 hover:text-red-300 transition-all"
                    title="Quitar de favoritas"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
