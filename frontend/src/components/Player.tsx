import { useEffect, useRef, useCallback, useState } from 'react';
import { Howl } from 'howler';
import { SkipBack, SkipForward, Play, Pause, Settings as SettingsIcon, Volume2, Heart } from 'lucide-react';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';
import { usePreferencesStore } from '../stores/preferencesStore';
import { api } from '../api/client';

export function Player() {
  const { 
    isPlaying, 
    volume, 
    progress, 
    duration,
    currentSong,
    setIsPlaying, 
    setProgress, 
    setDuration,
    next,
    prev,
    setVolume
  } = usePlayerStore();
  
  const token = useAuthStore((state) => state.token);
  const soundRef = useRef<Howl | null>(null);
  const intervalRef = useRef<number | null>(null);
  const song = currentSong();
  const setIsBackgroundSettingsOpen = usePreferencesStore((state) => state.setIsBackgroundSettingsOpen);
  const hudColor = usePreferencesStore((state) => state.preferences.hud_color);
  const [isFavorite, setIsFavorite] = useState(false);

  // Check favorite status when song changes
  useEffect(() => {
    if (!song) { setIsFavorite(false); return; }
    api.get(`/favorites/check/${song.id}`)
      .then(res => setIsFavorite(res.data.isFavorite))
      .catch(() => setIsFavorite(false));
  }, [song?.id]);

  const toggleFavorite = async () => {
    if (!song) return;
    try {
      if (isFavorite) {
        await api.delete(`/favorites/${song.id}`);
        setIsFavorite(false);
      } else {
        await api.post(`/favorites/${song.id}`);
        setIsFavorite(true);
      }
    } catch (err) {
      console.error('Favorite toggle error:', err);
    }
  };

  // Clear progress interval
  const clearProgressInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start progress tracking
  const startProgressTracking = useCallback(() => {
    clearProgressInterval();
    intervalRef.current = window.setInterval(() => {
      if (soundRef.current && soundRef.current.playing()) {
        const seek = soundRef.current.seek() as number;
        setProgress(seek);
        const dur = soundRef.current.duration();
        if (dur && dur > 0) {
          setDuration(dur);
        }
      }
    }, 250);
  }, [clearProgressInterval, setProgress, setDuration]);

  // Load new song
  useEffect(() => {
    if (!song || !token) return;

    // Unload previous sound
    if (soundRef.current) {
      soundRef.current.unload();
      soundRef.current = null;
    }
    clearProgressInterval();

    const streamUrl = `http://localhost:3001/api/songs/${song.id}/stream?token=${token}`;

    const sound = new Howl({
      src: [streamUrl],
      html5: true,
      format: ['mp3', 'wav', 'flac', 'm4a', 'mp4', 'ogg'],
      volume: volume,
      onload: () => {
        setDuration(sound.duration());
      },
      onplay: () => {
        setDuration(sound.duration());
        startProgressTracking();
      },
      onpause: () => {
        clearProgressInterval();
      },
      onstop: () => {
        clearProgressInterval();
      },
      onend: () => {
        clearProgressInterval();
        next();
      },
      onloaderror: (_id, err) => {
        console.error('Howler load error:', err);
      },
      onplayerror: (_id, err) => {
        console.error('Howler play error:', err);
        // Attempt to unlock audio context on mobile
        if (soundRef.current) {
          soundRef.current.once('unlock', () => {
            soundRef.current?.play();
          });
        }
      }
    });

    soundRef.current = sound;
    // Auto-play the song when it loads
    sound.play();

    return () => {
      clearProgressInterval();
      sound.unload();
    };
  }, [song?.id, token]);

  // Play/pause control
  useEffect(() => {
    if (!soundRef.current) return;
    if (isPlaying) {
      if (!soundRef.current.playing()) {
        soundRef.current.play();
      }
    } else {
      soundRef.current.pause();
    }
  }, [isPlaying]);

  // Volume control
  useEffect(() => {
    if (!soundRef.current) return;
    soundRef.current.volume(volume);
  }, [volume]);

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!soundRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newPos = percentage * duration;
    soundRef.current.seek(newPos);
    setProgress(newPos);
  };

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <section className="flex-1 relative h-full flex flex-col justify-end p-12 z-0">
      {/* Vinyl Visualizer */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/4 w-[600px] h-[600px] rounded-full border border-white/10 bg-surface-lowest/50 backdrop-blur-sm flex items-center justify-center opacity-30 pointer-events-none">
        <div className="w-[500px] h-[500px] rounded-full border border-white/10 flex items-center justify-center">
          <div 
            className={`w-48 h-48 rounded-full shadow-[0_0_50px_rgba(0,219,233,0.3)] ${isPlaying ? 'animate-pulse' : ''}`}
            style={{ background: `linear-gradient(135deg, ${hudColor}, ${hudColor}80)` }}
          />
        </div>
      </div>

      {/* Player Controls */}
      <div className="glass-panel rounded-xl p-8 max-w-2xl mx-auto w-full z-10">
        <div className="flex justify-between items-end mb-6">
          <div className="min-w-0 flex-1">
            <h2 className="font-display-lg text-4xl text-on-surface truncate">{song?.title || 'No song selected'}</h2>
            <p className="font-body-lg text-lg mt-2 truncate" style={{ color: hudColor }}>{song?.artist || '-'}</p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
             <button 
               onClick={toggleFavorite}
               className={`p-2 rounded-full transition-all hover:scale-110 ${isFavorite ? 'text-red-400' : 'text-on-surface-variant hover:text-red-400'}`}
               title={isFavorite ? 'Quitar de favoritas' : 'Agregar a favoritas'}
             >
               <Heart className={`w-6 h-6 ${isFavorite ? 'fill-current' : ''}`} />
             </button>
             <div className="flex items-center gap-2 group relative">
                <Volume2 className="w-5 h-5 text-on-surface-variant group-hover:text-primary" />
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
                />
             </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-4 mb-8">
          <span className="font-label-sm text-xs text-on-surface-variant min-w-[32px]">{formatTime(progress)}</span>
          <div 
            className="flex-1 h-1 bg-white/10 rounded-full relative cursor-pointer"
            onClick={handleSeek}
          >
            <div 
              className="absolute top-0 left-0 h-full rounded-full shadow-[0_0_10px_rgba(0,219,233,0.5)]"
              style={{ 
                width: `${progressPercent}%`,
                background: `linear-gradient(to right, ${hudColor}, ${hudColor}80)`
              }}
            />
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] cursor-pointer hover:scale-125 transition-transform"
              style={{ left: `${progressPercent}%` }}
            />
          </div>
          <span className="font-label-sm text-xs text-on-surface-variant min-w-[32px]">{formatTime(duration)}</span>
        </div>

        {/* Transport Controls */}
        <div className="flex justify-center items-center gap-8">
          <button onClick={prev} className="text-on-surface hover:text-primary transition-colors">
            <SkipBack className="w-8 h-8" />
          </button>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-16 h-16 rounded-full text-on-primary flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_20px_rgba(0,219,233,0.4)]"
            style={{ backgroundColor: hudColor }}
          >
            {isPlaying ? <Pause className="w-9 h-9 fill-current" /> : <Play className="w-9 h-9 fill-current" />}
          </button>
          <button onClick={next} className="text-on-surface hover:text-primary transition-colors">
            <SkipForward className="w-8 h-8" />
          </button>
        </div>
      </div>
    </section>
  );
}
