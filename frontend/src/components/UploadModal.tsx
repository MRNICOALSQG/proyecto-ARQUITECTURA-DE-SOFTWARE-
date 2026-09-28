import { useState } from 'react';
import { UploadCloud, X, Music, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../api/client';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FileEntry {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

export function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!isOpen) return null;

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;
    const entries: FileEntry[] = Array.from(selected).map(f => ({ file: f, status: 'pending' }));
    setFiles(prev => [...prev, ...entries]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach(entry => formData.append('audio', entry.file));
    if (artist) formData.append('artist', artist);
    if (album) formData.append('album', album);

    try {
      setLoading(true);
      setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' })));
      await api.post('/songs/upload', formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setProgress(percentCompleted);
        }
      });
      setFiles(prev => prev.map(f => ({ ...f, status: 'done' })));
      setTimeout(() => {
        onSuccess();
        onClose();
        setFiles([]);
        setArtist('');
        setAlbum('');
        setProgress(0);
      }, 800);
    } catch (err) {
      console.error('Upload error:', err);
      setFiles(prev => prev.map(f => ({ ...f, status: 'error' })));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md p-6 rounded-2xl relative max-h-[90vh] flex flex-col">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-white/5"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-headline-md text-2xl text-on-surface mb-6 flex items-center gap-2">
          <UploadCloud className="text-primary" />
          Importar Música
        </h2>

        <form onSubmit={handleUpload} className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div 
            className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer relative shrink-0"
          >
            <input 
              type="file" 
              accept="audio/*,video/mp4"
              multiple
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFilesSelected}
            />
            <div className="flex flex-col items-center gap-2 text-on-surface-variant">
              <UploadCloud className="w-8 h-8" />
              <span className="font-label-sm text-sm">Arrastra o haz clic para seleccionar</span>
              <span className="text-xs opacity-50">Puedes seleccionar varias canciones a la vez</span>
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-40 pr-1">
              {files.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 bg-surface/40 rounded-lg px-3 py-2 border border-white/5">
                  <Music className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm text-on-surface truncate flex-1">{entry.file.name}</span>
                  {entry.status === 'done' && <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />}
                  {entry.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                  {entry.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="p-0.5 text-on-surface-variant hover:text-error transition-colors shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 shrink-0">
            <div>
              <label className="block font-label-sm text-xs text-on-surface-variant mb-1 ml-1">Artista</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full bg-surface/40 border border-white/10 rounded-lg py-2 px-4 text-sm text-on-surface focus:outline-none focus:border-primary/50 transition-all"
                placeholder="Nombre del artista"
              />
            </div>
            <div>
              <label className="block font-label-sm text-xs text-on-surface-variant mb-1 ml-1">Álbum</label>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                className="w-full bg-surface/40 border border-white/10 rounded-lg py-2 px-4 text-sm text-on-surface focus:outline-none focus:border-primary/50 transition-all"
                placeholder="Nombre del álbum"
              />
            </div>
          </div>

          {loading && (
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden shrink-0">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={files.length === 0 || loading}
            className="w-full py-3 mt-2 rounded-full bg-primary text-on-primary font-bold shadow-[0_0_20px_rgba(0,219,233,0.3)] hover:scale-[1.02] transition-all disabled:opacity-50 shrink-0"
          >
            {loading ? `Subiendo... ${progress}%` : `Subir ${files.length} canción${files.length !== 1 ? 'es' : ''}`}
          </button>
        </form>
      </div>
    </div>
  );
}
