import React from 'react';
import { AppView, User } from '../types';
import { Bug, Trophy, Swords, LogOut, Upload, LayoutDashboard } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  currentView: AppView;
  setView: (view: AppView) => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, currentView, setView, onLogout }) => {
  if (!user) return null;

  const NavItem = ({ view, icon: Icon, label }: { view: AppView; icon: any; label: string }) => (
    <button
      onClick={() => setView(view)}
      className={`flex flex-col items-center justify-center w-full h-full p-2 transition-colors duration-200 border-t-2 ${
        currentView === view 
          ? 'border-green-500 text-green-400 bg-slate-800/50' 
          : 'border-transparent text-slate-400 hover:text-green-200 hover:bg-slate-800/30'
      }`}
    >
      <Icon size={20} />
      <span className="text-xs mt-1 font-medium hidden md:block">{label}</span>
    </button>
  );

  return (
    <nav className="fixed bottom-0 left-0 w-full h-16 bg-slate-900/95 backdrop-blur-md border-t border-slate-700 z-50 md:top-0 md:bottom-auto md:h-20 md:border-t-0 md:border-b">
      <div className="max-w-6xl mx-auto h-full flex items-center justify-between px-4">
        <div className="hidden md:flex items-center gap-3 text-green-500">
          <Bug size={32} className="drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
          <span className="text-2xl font-bold tracking-tighter font-['Orbitron']">BUG BATTLE</span>
        </div>

        <div className="flex-1 flex items-center justify-around h-full md:max-w-lg md:mx-auto">
          <NavItem view={AppView.DASHBOARD} icon={LayoutDashboard} label="HQ" />
          <NavItem view={AppView.MY_BUGS} icon={Bug} label="My Swarm" />
          <NavItem view={AppView.BATTLE_ARENA} icon={Swords} label="Arena" />
          <NavItem view={AppView.UPLOAD} icon={Upload} label="Recruit" />
          <NavItem view={AppView.HALL_OF_FAME} icon={Trophy} label="Rankings" />
        </div>

        <div className="hidden md:flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-bold text-slate-200">{user.username}</div>
            <div className="text-xs text-slate-500">{user.email}</div>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 hover:text-red-400 text-slate-400 transition-colors"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
};