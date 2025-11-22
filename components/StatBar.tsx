import React from 'react';

interface StatBarProps {
  label: string;
  value: number;
  color?: string;
}

export const StatBar: React.FC<StatBarProps> = ({ label, value, color = "bg-green-500" }) => {
  return (
    <div className="w-full mb-2">
      <div className="flex justify-between text-xs uppercase font-bold text-slate-400 mb-1">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
        <div 
          className={`h-full ${color} shadow-[0_0_10px_currentColor] transition-all duration-1000`} 
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
};
