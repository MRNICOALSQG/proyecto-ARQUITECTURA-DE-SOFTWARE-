import { useState, useEffect } from 'react';
import { ListMusic, Plus, Edit2, Trash2, ChevronLeft, Music as MusicIcon, Play } from 'lucide-react';
import { api, getImageUrl } from '../api/client';
import { EditPlaylistModal } from './EditPlaylistModal';
import { CreatePlaylistModal } from './CreatePlaylistModal';
import { AddSongsToPlaylistPanel } from './AddSongsToPlaylistPanel';
import { usePlayerStore, type Song } from '../stores/playerStore';

interface PlaylistsProps {
  libraryOpen: boolean;
}

interface Playlist {
  id: string;
  name: string;
  cover_url?: string;
}

export function Playlists({ libraryOpen }: PlaylistsProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [playlistToEdit, setPlaylistToEdit] = useState<Playlist | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddSongsOpen, setIsAddSongsOpen] = useState(false);

  const { playSong, setQueue } = usePlayerStore();

  const fetchPlaylists = async () => {
    try {
      const res = await api.get('/playlists');
      setPlaylists(res.data.playlists);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const editPlaylist = (e: React.MouseEvent, playlist: Playlist) => {
    e.stopPropagation();
    setPlaylistToEdit(playlist);
  };

  const deletePlaylist = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar esta playlist?')) return;
    try {
      await api.delete(`/playlists/${id}`);
      fetchPlaylists();
      if (selectedPlaylist?.id === id) setSelectedPlaylist(null);
    } catch (err) {
      console.error(err);
    }
  };

  const openPlaylist = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    try {
      const res = await api.get(`/playlists/${playlist.id}/songs`);
      setPlaylistSongs(res.data.songs);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshPlaylistSongs = async () => {
    if (!selectedPlaylist) return;
    try {
      const res = await api.get(`/playlists/${selectedPlaylist.id}/songs`);
      setPlaylistSongs(res.data.songs);
    } catch (err) {
      console.error(err);
    }
  };

  const removeSong = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    if (!selectedPlaylist) return;
    try {
      await api.delete(`/playlists/${selectedPlaylist.id}/songs/${songId}`);
      refreshPlaylistSongs();
    } catch (err) {
      console.error(err);
      alert('Error al remover cancion');
    }
  };

  const handlePlaySong = (index: number) => {
    setQueue(playlistSongs);
    playSong(index);
  };

  // ──────────────────────────────────────────
  // Playlist detail view (selected playlist)
  // ──────────────────────────────────────────
  if (selectedPlaylist && libraryOpen) {
    return (
      <section className="w-full md:w-[450px] md:max-w-[40%] shrink-0 p-6 h-full flex flex-col gap-6 z-10 glass-panel border-r border-white/10 overflow-y-auto overflow-x-hidden transition-all duration-300">
        <div className="flex items-center gap-3 w-full shrink-0">
          <button 
            onClick={() => setSelectedPlaylist(null)}
            className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-white/5"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          {selectedPlaylist.cover_url ? (
            <img src={getImageUrl(selectedPlaylist.cover_url)} alt={selectedPlaylist.name} className="w-10 h-10 rounded object-cover" />
          ) : (
            <div className="w-10 h-10 rounded bg-surface-variant flex items-center justify-center text-primary">
              <ListMusic className="w-5 h-5" />
            </div>
          )}
          <h2 className="font-headline-md text-xl text-on-surface truncate flex-1">{selectedPlaylist.name}</h2>
          <button
            onClick={() => setIsAddSongsOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-primary/40 text-primary text-xs hover:bg-primary/10 transition-colors neon-bloom"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xl:inline">Añadir</span>
          </button>
        </div>

        <div className="flex flex-col gap-3 w-full pb-20">
          {playlistSongs.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-48 text-on-surface-variant gap-4 opacity-70">
               <MusicIcon className="w-12 h-12" />
               <p className="text-sm text-center">La playlist está vacía.<br/>Haz clic en <strong>"Añadir"</strong> para agregar canciones.</p>
             </div>
          ) : (
            playlistSongs.map((song, index) => (
              <div 
                key={song.id}
                onClick={() => handlePlaySong(index)}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
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
                  <div className="min-w-0">
                    <h4 className="font-body-md text-[16px] text-on-surface truncate">{song.title}</h4>
                    <p className="font-label-sm text-[12px] text-on-surface-variant truncate">{song.artist}</p>
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-all shrink-0">
                  <button 
                    onClick={(e) => removeSong(e, song.id)}
                    className="p-1 text-on-error hover:text-red-400 transition-all"
                    title="Remover de la playlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <AddSongsToPlaylistPanel
          isOpen={isAddSongsOpen}
          onClose={() => setIsAddSongsOpen(false)}
          playlistId={selectedPlaylist.id}
          existingSongIds={playlistSongs.map(s => s.id)}
          onSuccess={refreshPlaylistSongs}
        />
      </section>
    );
  }

  // ──────────────────────────────────────────
  // Playlist list view
  // ──────────────────────────────────────────
  return (
    <section className={`${libraryOpen ? 'w-full md:w-[450px] md:max-w-[40%] shrink-0 p-6' : 'hidden md:flex w-20 shrink-0 p-4 items-center'} h-full flex flex-col gap-6 z-10 glass-panel border-r-0 md:border-r border-white/10 overflow-x-hidden overflow-y-auto transition-all duration-300`}>
      <div className={`${libraryOpen ? 'justify-between' : 'justify-center'} flex items-center w-full shrink-0`}>
        {libraryOpen && <h2 className="font-headline-md text-2xl text-on-surface">Playlists</h2>}
        {libraryOpen && (
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-primary/40 text-primary hover:bg-primary/10 transition-colors neon-bloom"
          >
            <Plus className="w-[18px] h-[18px]" />
            <span className="font-label-sm text-label-sm hidden xl:inline">Nueva Playlist</span>
          </button>
        )}
      </div>

      <div className={`${libraryOpen ? '' : 'items-center mt-4'} flex flex-col gap-3 w-full pb-20`}>
        {playlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-on-surface-variant gap-4 opacity-70">
            <ListMusic className="w-16 h-16" />
            {libraryOpen && (
              <div className="text-center">
                <p className="font-label-sm text-sm">Aún no tienes playlists.</p>
              </div>
            )}
          </div>
        ) : (
          playlists.map(playlist => (
            <div 
              key={playlist.id}
              onClick={() => libraryOpen && openPlaylist(playlist)}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded bg-surface-variant flex items-center justify-center text-primary shrink-0 overflow-hidden">
                  {playlist.cover_url ? (
                    <img src={getImageUrl(playlist.cover_url)} alt={playlist.name} className="w-full h-full object-cover" />
                  ) : (
                    <ListMusic className="w-5 h-5" />
                  )}
                </div>
                {libraryOpen && (
                  <div className="min-w-0">
                    <h4 className="font-body-md text-[16px] text-on-surface truncate">{playlist.name}</h4>
                  </div>
                )}
              </div>
              {libraryOpen && (
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-all">
                  <button 
                    onClick={(e) => editPlaylist(e, playlist)}
                    className="p-1 text-on-surface-variant hover:text-primary transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => deletePlaylist(e, playlist.id)}
                    className="p-1 text-on-surface-variant hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <CreatePlaylistModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchPlaylists}
      />

      <EditPlaylistModal
        isOpen={!!playlistToEdit}
        onClose={() => setPlaylistToEdit(null)}
        playlist={playlistToEdit}
        onSuccess={() => {
          fetchPlaylists();
          if (selectedPlaylist && selectedPlaylist.id === playlistToEdit?.id) {
            setSelectedPlaylist(null);
          }
        }}
      />
    </section>
  );
}
