import { create } from 'zustand';

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  file_path: string;
  cover_path: string | null;
  duration_seconds: number;
}

interface PlayerState {
  queue: Song[];
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  currentSong: () => Song | null;
  setQueue: (songs: Song[]) => void;
  playSong: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  next: () => void;
  prev: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  volume: 1,
  progress: 0,
  duration: 0,
  currentSong: () => {
    const { queue, currentIndex } = get();
    return currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;
  },
  setQueue: (songs) => set({ queue: songs }),
  playSong: (index) => set({ currentIndex: index, isPlaying: true, progress: 0 }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume }),
  setProgress: (progress) => set({ progress }),
  setDuration: (duration) => set({ duration }),
  next: () => set((state) => {
    if (state.currentIndex < state.queue.length - 1) {
      return { currentIndex: state.currentIndex + 1, progress: 0 };
    }
    return { isPlaying: false };
  }),
  prev: () => set((state) => {
    if (state.progress > 3) {
      return { progress: 0 }; // Restart song if >3s
    }
    if (state.currentIndex > 0) {
      return { currentIndex: state.currentIndex - 1, progress: 0 };
    }
    return { progress: 0 };
  })
}));
