import { useState, useEffect } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import { api, getImageUrl } from '../api/client';
import type { Song } from '../stores/playerStore';

interface EditSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
  onSuccess: () => void;
}

export function EditSongModal({ isOpen, onClose, song, onSuccess }: EditSongModalProps) {
  const [title, setTitle] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (song) {
      setTitle(song.title);
      setPreviewUrl(song.cover_path || null);
    }
  }, [song]);

  if (!isOpen || !song) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      let cover_path = song.cover_path;

      if (coverFile) {
        const formData = new FormData();
        formData.append('image', coverFile);
        const uploadRes = await api.post('/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        cover_path = uploadRes.data.url;
      }

      await api.put(`/songs/${song.id}`, { title, cover_path });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Update error:', error);
      alert('Error updating song');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-md p-6 rounded-2xl relative shadow-2xl border border-white/10">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-white/5"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-headline-md text-2xl text-on-surface mb-6">Personalizar Canción</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center mb-4">
            <label className="w-32 h-32 rounded-lg bg-surface/50 border border-white/10 flex flex-col items-center justify-center text-on-surface-variant cursor-pointer hover:bg-white/5 hover:text-primary transition-colors group relative overflow-hidden">
              {previewUrl ? (
                <img src={getImageUrl(previewUrl)} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
              )}
              <div className={`absolute inset-0 bg-black/50 ${previewUrl ? 'opacity-0 group-hover:opacity-100' : ''} flex flex-col items-center justify-center transition-opacity`}>
                <ImageIcon className="w-8 h-8 mb-2 text-white" />
                <span className="text-xs text-white">Cambiar Portada</span>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          <div>
            <label className="block font-label-sm text-xs text-on-surface-variant mb-1 ml-1">NOMBRE DE LA CANCIÓN</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-surface/40 border border-white/10 rounded-lg py-3 px-4 text-sm text-on-surface focus:outline-none focus:border-primary/50 transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full bg-primary text-on-primary font-bold shadow-[0_0_15px_rgba(0,219,233,0.3)] hover:scale-[1.02] transition-all disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </form>
      </div>
    </div>
  );
}
