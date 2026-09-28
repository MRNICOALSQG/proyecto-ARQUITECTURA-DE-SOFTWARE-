import { useState, useEffect, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, Music as MusicIcon, Search, Trash2, Edit2, ArrowUpDown, Heart } from 'lucide-react';
import { api, getImageUrl } from '../api/client';
import { usePlayerStore, type Song } from '../stores/playerStore';
import { UploadModal } from './UploadModal';
import { EditSongModal } from './EditSongModal';
import { AddToPlaylistModal } from './AddToPlaylistModal';

interface LibraryProps {
  libraryOpen: boolean;
  setLibraryOpen: (open: boolean) => void;
}

export function Library({ libraryOpen, setLibraryOpen }: LibraryProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [search, setSearch] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [songToEdit, setSongToEdit] = useState<Song | null>(null);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [songToAdd, setSongToAdd] = useState<Song | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'duration'>('date');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const { playSong, setQueue, currentIndex } = usePlayerStore();

  const fetchFavorites = async () => {
    try {
      const res = await api.get('/favorites');
      const ids = new Set<string>(res.data.songs.map((s: Song) => s.id));
      setFavoriteIds(ids);
    } catch (err) {
      console.error('Error fetching favorites:', err);
    }
  };

  const fetchSongs = async () => {
    try {
      const res = await api.get(`/songs?search=${search}`);
      setSongs(res.data.songs);
      setQueue(res.data.songs);
    } catch (err) {
      console.error('Error fetching songs:', err);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, [search]);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const toggleFavorite = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    try {
      if (favoriteIds.has(songId)) {
        await api.delete(`/favorites/${songId}`);
        setFavoriteIds(prev => { const n = new Set(prev); n.delete(songId); return n; });
      } else {
        await api.post(`/favorites/${songId}`);
        setFavoriteIds(prev => new Set(prev).add(songId));
      }
    } catch (err) {
      console.error('Favorite toggle error:', err);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    setSongToDelete(song);
  };

  const handleDeleteConfirm = async () => {
    if (!songToDelete) return;
    try {
      await api.delete(`/songs/${songToDelete.id}`);
      fetchSongs();
      setSongToDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const editSong = async (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    setSongToEdit(song);
  };

  const sortedSongs = useMemo(() => {
    let sorted = [...songs];
    if (sortBy === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'duration') {
      // Assuming you have duration_seconds but let's sort by duration string or ID if not available
      sorted.sort((a, b) => (b.duration_seconds || 0) - (a.duration_seconds || 0));
    } else {
      // Default date (ID acts as proxy for date if no date field, or assume backend sorted by date)
      // Since backend already sorts by uploaded_at DESC, doing nothing preserves date order
    }
    return sorted;
  }, [songs, sortBy]);

  return (
    <section className={`${libraryOpen ? 'w-full md:w-[450px] md:max-w-[40%] shrink-0' : 'hidden md:flex w-full md:w-20 p-4 items-center'} h-full flex flex-col gap-6 z-10 glass-panel border-r-0 md:border-r border-white/10 overflow-x-hidden overflow-y-auto transition-all duration-300`}>
      <div className={`${libraryOpen ? 'justify-between p-6 pb-0' : 'justify-center'} flex items-center w-full shrink-0`}>
        {libraryOpen && <h2 className="font-headline-md text-2xl text-on-surface">Library</h2>}
        <div className="flex items-center gap-2">
          {libraryOpen && (
            <>
              <div className="relative">
                <button 
                  onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 text-on-surface-variant hover:text-primary transition-colors hover:bg-white/5"
                  title="Sort by"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
                {sortDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-32 bg-surface-container border border-white/10 rounded-lg shadow-lg overflow-hidden z-20">
                    <button onClick={() => { setSortBy('date'); setSortDropdownOpen(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors ${sortBy === 'date' ? 'text-primary' : 'text-on-surface'}`}>Fecha</button>
                    <button onClick={() => { setSortBy('title'); setSortDropdownOpen(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors ${sortBy === 'title' ? 'text-primary' : 'text-on-surface'}`}>Nombre</button>
                    <button onClick={() => { setSortBy('duration'); setSortDropdownOpen(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors ${sortBy === 'duration' ? 'text-primary' : 'text-on-surface'}`}>Duración</button>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-primary/40 text-primary hover:bg-primary/10 transition-colors neon-bloom"
              >
                <Plus className="w-[18px] h-[18px]" />
                <span className="font-label-sm text-label-sm hidden xl:inline">Importar música</span>
              </button>
            </>
          )}
          <button 
            onClick={() => setLibraryOpen(!libraryOpen)} 
            className="p-2 rounded-full border border-white/10 text-on-surface-variant hover:text-primary transition-colors hover:bg-white/5 shrink-0 flex items-center justify-center"
          >
            {libraryOpen ? <ChevronLeft className="w-[18px] h-[18px]" /> : <ChevronRight className="w-[18px] h-[18px]" />}
          </button>
        </div>
      </div>

      {libraryOpen && (
        <div className="relative w-full px-6">
          <Search className="absolute left-9 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input 
            type="text"
            placeholder="Buscar en tu biblioteca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface/40 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-on-surface focus:outline-none focus:border-primary/50 transition-all"
          />
        </div>
      )}

      <div className={`${libraryOpen ? 'px-6' : 'items-center mt-4'} flex flex-col gap-3 w-full pb-20`}>
        {sortedSongs.map((song, index) => (
          <div 
            key={song.id}
            onClick={() => playSong(index)}
            className={`${libraryOpen ? 'gap-4 p-3' : 'justify-center p-2'} flex items-center rounded-lg ${currentIndex === index ? 'bg-primary/10 border-primary/30' : 'bg-surface/40 border-white/5'} border hover:border-primary/30 hover:bg-white/5 transition-all cursor-pointer group w-full`}
          >
            <div className="w-12 h-12 rounded-md shrink-0 bg-gradient-to-br from-secondary-container to-surface-container flex items-center justify-center overflow-hidden">
              {song.cover_path ? (
                <img src={getImageUrl(song.cover_path)} alt="" className="w-full h-full object-cover" />
              ) : (
                <MusicIcon className="w-6 h-6 text-primary" />
              )}
            </div>
            {libraryOpen && (
              <>
                <div className="flex-1 min-w-0">
                  <h4 className="font-body-md text-[16px] text-on-surface truncate">{song.title}</h4>
                  <p className="font-label-sm text-[12px] text-on-surface-variant truncate">{song.artist}</p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-all shrink-0">
                  <button 
                    onClick={(e) => toggleFavorite(e, song.id)}
                    className={`p-1 transition-all ${favoriteIds.has(song.id) ? 'text-red-400' : 'text-on-surface-variant hover:text-red-400'}`}
                    title={favoriteIds.has(song.id) ? 'Quitar de favoritas' : 'Agregar a favoritas'}
                  >
                    <Heart className={`w-4 h-4 ${favoriteIds.has(song.id) ? 'fill-current' : ''}`} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSongToAdd(song); }}
                    className="p-1 text-on-surface-variant hover:text-primary transition-all"
                    title="Añadir a Playlist"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => editSong(e, song)}
                    className="p-1 text-on-surface-variant hover:text-primary transition-all"
                    title="Editar Canción"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => handleDeleteClick(e, song)}
                    className="p-1 text-on-surface-variant hover:text-error transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        onSuccess={fetchSongs} 
      />

      <EditSongModal 
        isOpen={!!songToEdit} 
        onClose={() => setSongToEdit(null)} 
        song={songToEdit} 
        onSuccess={fetchSongs} 
      />

      <AddToPlaylistModal
        isOpen={!!songToAdd}
        onClose={() => setSongToAdd(null)}
        song={songToAdd}
      />
      {songToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface glass-panel p-6 rounded-2xl w-full max-w-sm border border-white/10 shadow-2xl animate-fade-in">
            <h3 className="font-headline-md text-xl text-on-surface mb-2">Eliminar Canción</h3>
            <p className="text-on-surface-variant text-sm mb-6">
              ¿Estás seguro de que deseas eliminar <strong>{songToDelete.title}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setSongToDelete(null)}
                className="px-4 py-2 rounded-full text-on-surface hover:bg-white/5 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-full bg-error text-white hover:bg-red-600 transition-colors text-sm font-medium shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
