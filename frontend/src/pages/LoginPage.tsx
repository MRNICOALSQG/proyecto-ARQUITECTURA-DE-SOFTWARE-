import { useState } from 'react';
import { api } from '../api/client';
import { useAuthStore } from '../stores/authStore';

export function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin ? { email, password } : { email, password, username };
      
      const res = await api.post(endpoint, payload);
      setAuth(res.data.token, res.data.user);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ocurrió un error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cyberpunk p-4">
      <div className="glass-panel max-w-md w-full p-8 rounded-2xl">
        <h2 className="font-display-lg text-4xl text-primary text-center mb-2 italic tracking-tighter drop-shadow-[0_0_10px_rgba(0,219,233,0.4)]">
          Rin'ne
        </h2>
        <p className="text-on-surface-variant text-center mb-8 font-label-sm uppercase tracking-widest">
          {isLogin ? 'Inicia sesión en tu espacio' : 'Crea tu cuenta musical'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-error/20 border border-error/50 text-error rounded-lg text-sm">
              {error}
            </div>
          )}

          {!isLogin && (
            <div>
              <label className="block font-label-sm text-xs text-on-surface-variant mb-2 ml-1">USERNAME</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-surface/40 border border-white/10 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary/50 transition-all"
                placeholder="CyberMusicUser"
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label className="block font-label-sm text-xs text-on-surface-variant mb-2 ml-1">EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface/40 border border-white/10 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary/50 transition-all"
              placeholder="alex@cipher.com"
              required
            />
          </div>

          <div>
            <label className="block font-label-sm text-xs text-on-surface-variant mb-2 ml-1">PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface/40 border border-white/10 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary/50 transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-full bg-primary text-on-primary font-bold shadow-[0_0_20px_rgba(0,219,233,0.3)] hover:scale-[1.02] transition-all disabled:opacity-50"
          >
            {loading ? 'Procesando...' : (isLogin ? 'ACCEDER' : 'REGISTRARSE')}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-on-surface-variant hover:text-primary transition-colors text-sm"
          >
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}
