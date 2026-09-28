import { useState } from 'react';
import { Music, ListMusic, Settings, HelpCircle, LogOut, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { usePreferencesStore } from '../stores/preferencesStore';
import { ProfileModal } from './ProfileModal';
import { getImageUrl } from '../api/client';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeTab: 'library' | 'playlists' | 'favorites';
  setActiveTab: (tab: 'library' | 'playlists' | 'favorites') => void;
}

export function Sidebar({ sidebarOpen, setSidebarOpen, activeTab, setActiveTab }: SidebarProps) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const setIsHudOpen = usePreferencesStore((state) => state.setIsHudOpen);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  return (
    <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} hidden md:flex fixed left-0 top-0 h-full flex-col z-40 bg-surface/20 backdrop-blur-[30px] text-primary font-body-md rounded-r-lg border-r border-white/20 shadow-[20px_0_40px_rgba(0,0,0,0.3)] transition-all duration-300`}>
      <div className={sidebarOpen ? 'p-6' : 'p-4 flex flex-col items-center'}>
        {sidebarOpen && (
          <div className="mb-6 px-1">
            <h2 className="font-display-lg text-[28px] font-bold tracking-tighter text-primary drop-shadow-[0_0_12px_rgba(0,219,233,0.5)] italic">
              Rin'ne
            </h2>
          </div>
        )}
        <div className={`${sidebarOpen ? '' : 'justify-center'} flex items-center gap-3 mb-8 w-full`}>
          <div className="w-12 h-12 rounded-full border border-white/20 shrink-0 bg-primary/20 flex items-center justify-center text-primary font-bold text-xl overflow-hidden">
            {user?.avatar_url ? (
              <img src={getImageUrl(user.avatar_url)} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              user?.username?.[0]?.toUpperCase() || 'U'
            )}
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h1 className="font-headline-md text-[16px] text-primary font-bold truncate">{user?.username}</h1>
                <button onClick={() => setIsProfileModalOpen(true)} className="text-on-surface-variant hover:text-primary transition-colors p-1 rounded-full hover:bg-white/5" title="Edit Profile">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
        <nav className="flex flex-col gap-2 w-full">
          <button 
            onClick={() => setActiveTab('library')}
            className={`${sidebarOpen ? 'gap-3' : 'justify-center'} flex items-center p-3 rounded-lg transition-all w-full text-left ${activeTab === 'library' ? 'bg-primary/10 text-primary border-l-4 border-primary shadow-[0_0_15px_rgba(0,219,233,0.2)] translate-x-1' : 'text-on-surface-variant hover:bg-white/5 hover:text-primary'}`}
          >
            <Music className="w-6 h-6 shrink-0" />
            {sidebarOpen && <span>Music</span>}
          </button>
          <button 
            onClick={() => setActiveTab('playlists')}
            className={`${sidebarOpen ? 'gap-3' : 'justify-center'} flex items-center p-3 rounded-lg transition-all w-full text-left ${activeTab === 'playlists' ? 'bg-primary/10 text-primary border-l-4 border-primary shadow-[0_0_15px_rgba(0,219,233,0.2)] translate-x-1' : 'text-on-surface-variant hover:bg-white/5 hover:text-primary'}`}
          >
            <ListMusic className="w-6 h-6 shrink-0" />
            {sidebarOpen && <span>Playlist</span>}
          </button>
          <button 
            onClick={() => setActiveTab('favorites')}
            className={`${sidebarOpen ? 'gap-3' : 'justify-center'} flex items-center p-3 rounded-lg transition-all w-full text-left ${activeTab === 'favorites' ? 'bg-primary/10 text-primary border-l-4 border-primary shadow-[0_0_15px_rgba(0,219,233,0.2)] translate-x-1' : 'text-on-surface-variant hover:bg-white/5 hover:text-primary'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 shrink-0"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            {sidebarOpen && <span>Favoritas</span>}
          </button>
          <button onClick={() => setIsHudOpen(true)} className={`${sidebarOpen ? 'gap-3' : 'justify-center'} flex items-center p-3 rounded-lg text-on-surface-variant hover:bg-white/5 hover:text-primary transition-all w-full`}>
            <Settings className="w-6 h-6" />
            {sidebarOpen && <span>Preferences</span>}
          </button>
        </nav>
      </div>
      <div className={`${sidebarOpen ? 'p-6' : 'p-4 items-center'} mt-auto flex flex-col gap-4`}>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-full flex items-center justify-center p-2 rounded-lg text-on-surface-variant hover:bg-white/5 hover:text-primary transition-all bg-surface/30 border border-white/5">
          {sidebarOpen ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
        </button>
        <div className="flex flex-col gap-2 w-full">
          <a href="#" className={`${sidebarOpen ? 'gap-3' : 'justify-center'} flex items-center p-2 rounded-lg text-on-surface-variant hover:bg-white/5 hover:text-primary transition-all`}>
            <HelpCircle className="w-5 h-5" />
            {sidebarOpen && <span className="font-label-sm text-label-sm">Support</span>}
          </a>
          <button onClick={logout} className={`${sidebarOpen ? 'gap-3' : 'justify-center'} flex items-center p-2 rounded-lg text-on-surface-variant hover:bg-white/5 hover:text-primary transition-all w-full`}>
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span className="font-label-sm text-label-sm">Logout</span>}
          </button>
        </div>
      </div>
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
    </aside>
  );
}
