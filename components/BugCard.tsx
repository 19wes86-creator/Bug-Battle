import React from 'react';
import { Bug } from '../types';
import { StatBar } from './StatBar';
import { Heart, Trophy, XCircle } from 'lucide-react';

interface BugCardProps {
  bug: Bug;
  onClick?: () => void;
  compact?: boolean;
  selectable?: boolean;
  selected?: boolean;
}

export const BugCard: React.FC<BugCardProps> = ({ bug, onClick, compact = false, selectable, selected }) => {
  const healthPercent = (bug.currentHp / bug.maxHp) * 100;
  const healthColor = healthPercent > 50 ? 'bg-green-500' : healthPercent > 20 ? 'bg-yellow-500' : 'bg-red-600';

  return (
    <div 
      onClick={onClick}
      className={`relative group bg-slate-900 border rounded-xl overflow-hidden transition-all duration-300
        ${selectable ? 'cursor-pointer hover:-translate-y-1' : ''}
        ${selected ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)] ring-2 ring-green-500 ring-offset-2 ring-offset-slate-900' : 'border-slate-700 hover:border-slate-500'}
      `}
    >
      {/* Image Header */}
      <div className={`relative w-full ${compact ? 'h-32' : 'h-48'} overflow-hidden bg-black`}>
        <img src={bug.imageUrl} alt={bug.species} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-slate-900 to-transparent" />
        
        <div className="absolute bottom-2 left-3 right-3">
          <h3 className="text-lg font-bold font-['Orbitron'] text-white leading-tight">{bug.nickname || bug.species}</h3>
          <p className="text-xs text-green-400 font-medium tracking-wider">{bug.species}</p>
        </div>

        {/* HP Bar Overlay */}
        <div className="absolute top-2 right-2 left-2 flex flex-col items-end">
             <div className="flex items-center text-xs font-bold mb-1 drop-shadow-md">
                <Heart size={12} className="text-red-500 mr-1 fill-red-500" />
                {bug.currentHp}/{bug.maxHp}
             </div>
             <div className="w-full h-1.5 bg-slate-800/80 rounded-full backdrop-blur">
                 <div className={`h-full rounded-full ${healthColor}`} style={{ width: `${healthPercent}%` }} />
             </div>
        </div>
      </div>

      {/* Stats Body */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
           {!compact && (
             <>
               <StatBar label="STR" value={bug.stats.strength} />
               <StatBar label="ATK" value={bug.stats.attack} />
               <StatBar label="SPD" value={bug.stats.agility} />
               <StatBar label="DEF" value={bug.stats.willingnessToLive} />
             </>
           )}
           {compact && (
             <div className="col-span-2 text-xs text-slate-400 line-clamp-2 italic">
               "{bug.description.substring(0, 60)}..."
             </div>
           )}
        </div>

        <div className="flex justify-between items-center border-t border-slate-800 pt-3 mt-2">
          <div className="flex items-center gap-1 text-yellow-500 text-sm font-bold">
            <Trophy size={14} />
            {bug.wins} W
          </div>
          <div className="flex items-center gap-1 text-red-400 text-sm font-bold">
            <XCircle size={14} />
            {bug.losses} L
          </div>
        </div>
      </div>
    </div>
  );
};
