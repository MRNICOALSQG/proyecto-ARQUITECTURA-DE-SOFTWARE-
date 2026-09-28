import { useState } from 'react';
import { User, X, Camera } from 'lucide-react';
import { api, getImageUrl } from '../api/client';
import { useAuthStore } from '../stores/authStore';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const user = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const token = useAuthStore((state) => state.token);
  
  const [username, setUsername] = useState(user?.username || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user?.avatar_url || null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || (username === user?.username && !avatarFile)) {
      onClose();
      return;
    }

    try {
      setLoading(true);
      let avatar_url = user?.avatar_url;

      if (avatarFile) {
        const formData = new FormData();
        formData.append('image', avatarFile);
        const uploadRes = await api.post('/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        avatar_url = uploadRes.data.url;
      }

      const res = await api.put('/auth/profile', { username, avatar_url });
      // Update local state with new user info
      if (token && res.data.user) {
        setAuth(token, res.data.user);
      }
      onClose();
    } catch (err) {
      console.error('Update profile error:', err);
      alert('Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-sm p-6 rounded-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-white/5"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-headline-md text-2xl text-on-surface mb-6 flex items-center gap-2">
          <User className="text-primary" />
          Edit Profile
        </h2>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex flex-col items-center">
            <label className="w-24 h-24 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center relative group cursor-pointer overflow-hidden">
              {previewUrl ? (
                <img src={getImageUrl(previewUrl)} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary font-display-lg text-4xl">{username[0]?.toUpperCase() || 'U'}</span>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
            <span className="font-label-sm text-xs text-on-surface-variant mt-2 opacity-60">Haz clic para cambiar foto</span>
          </div>

          <div>
            <label className="block font-label-sm text-xs text-on-surface-variant mb-1 ml-1 uppercase">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-surface/40 border border-white/10 rounded-lg py-2 px-4 text-sm text-on-surface focus:outline-none focus:border-primary/50 transition-all"
              placeholder="Your new username"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-4 rounded-full bg-primary text-on-primary font-bold shadow-[0_0_15px_rgba(0,219,233,0.3)] hover:scale-[1.02] transition-all disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
