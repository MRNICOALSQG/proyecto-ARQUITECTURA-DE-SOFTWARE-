import { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Library } from '../components/Library';
import { Playlists } from '../components/Playlists';
import { Favorites } from '../components/Favorites';
import { Player } from '../components/Player';
import { Menu, Settings } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { usePreferencesStore } from '../stores/preferencesStore';
import { PreferencesPanel } from '../components/PreferencesPanel';
import { BackgroundSettingsPanel } from '../components/BackgroundSettingsPanel';
import { BackgroundParticles } from '../components/BackgroundParticles';
import { getImageUrl } from '../api/client';

export function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'library' | 'playlists' | 'favorites'>('library');
  const user = useAuthStore((state) => state.user);
  const { preferences, fetchPreferences, setIsBackgroundSettingsOpen } = usePreferencesStore();

  useEffect(() => {
    fetchPreferences();
  }, []);

  // Apply HUD color as a CSS custom property to the whole app
  useEffect(() => {
    document.documentElement.style.setProperty('--hud-color', preferences.hud_color);
  }, [preferences.hud_color]);

  return (
    <div 
      className="h-screen w-full flex text-on-surface overflow-hidden relative"
      style={{ backgroundColor: '#131315' }}
    >
      {/* Dynamic Background */}
      <div 
        className="absolute inset-0 z-0 transition-all duration-700 ease-in-out"
        style={{
          backgroundColor: preferences.background_type === 'solid' 
            ? preferences.background_value 
            : undefined,
          backgroundImage: preferences.background_type === 'image'
            ? `url("${getImageUrl(preferences.background_value)}")`
            : undefined,
          backgroundSize: preferences.background_size || 'cover',
          backgroundPosition: preferences.background_position || 'center',
          backgroundRepeat: preferences.background_repeat || 'no-repeat',
        }}
      />
      
      {/* Background Particles Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <BackgroundParticles />
      </div>

      {/* Mobile NavBar */}
      <nav className="md:hidden flex justify-between items-center px-5 py-2 w-full absolute top-0 z-50 bg-surface/10 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold border border-white/20 overflow-hidden" style={{ color: preferences.hud_color }}>
             {user?.avatar_url ? (
              <img src={getImageUrl(user.avatar_url)} alt="" className="w-full h-full object-cover" />
             ) : (
              user?.username?.[0]?.toUpperCase()
             )}
          </div>
          <div className="font-display-lg text-lg tracking-tighter drop-shadow-[0_0_10px_rgba(0,219,233,0.4)]" style={{ color: preferences.hud_color }}>{user?.username}</div>
        </div>
        <div className="flex gap-4">
           <button onClick={() => setSidebarOpen(true)}>
             <Menu className="w-6 h-6" style={{ color: preferences.hud_color }} />
           </button>
        </div>
      </nav>

      <Sidebar 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className={`${sidebarOpen ? 'md:ml-64' : 'md:ml-20'} flex-1 ml-0 relative h-screen flex flex-col md:flex-row transition-all duration-300`}>
        {activeTab === 'library' && (
          <Library libraryOpen={libraryOpen} setLibraryOpen={setLibraryOpen} />
        )}
        {activeTab === 'playlists' && (
          <Playlists libraryOpen={libraryOpen} />
        )}
        {activeTab === 'favorites' && (
          <Favorites libraryOpen={libraryOpen} />
        )}
        <Player />
      </main>

      {/* Top Right Settings (Fixed) */}
      <div className="fixed top-6 right-6 md:top-12 md:right-12 z-50">
        <button 
          onClick={() => setIsBackgroundSettingsOpen(true)}
          className="p-3 rounded-full bg-surface/40 backdrop-blur-md border border-white/10 text-on-surface hover:text-primary transition-colors neon-bloom shadow-lg"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>

      <PreferencesPanel />
      <BackgroundSettingsPanel />
    </div>
  );
}
