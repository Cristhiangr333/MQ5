import React from 'react';
import { WORLDS } from '../data/worldsData';
import { WorldDefinition, PlayerStats } from '../types';
import { Lock, CheckCircle2, ChevronRight } from 'lucide-react';

interface WorldCardStripProps {
  currentWorldId: string;
  stats: PlayerStats;
  onSelectWorld: (worldId: string) => void;
}

export const WorldCardStrip: React.FC<WorldCardStripProps> = ({
  currentWorldId,
  stats,
  onSelectWorld,
}) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-white font-['Baloo_2'] flex items-center gap-2">
            <span>🗺️ Los 5 Mundos Matemáticos</span>
          </h3>
          <p className="text-xs text-slate-400">
            Cada mundo desarrolla una competencia matemática con mecánicas 3D únicas.
          </p>
        </div>
        <div className="text-xs font-mono text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full">
          Total XP: {stats.xp}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {WORLDS.map((world: WorldDefinition) => {
          const isSelected = world.id === currentWorldId;
          const isUnlocked = world.unlockedByDefault || stats.xp >= world.requiredXp;
          const progress = stats.worldProgress[world.id];
          const isCompleted = progress?.completed;

          return (
            <button
              key={world.id}
              onClick={() => isUnlocked && onSelectWorld(world.id)}
              disabled={!isUnlocked}
              className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between overflow-hidden group ${
                isSelected
                  ? 'bg-slate-800/95 border-amber-400/80 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/50'
                  : isUnlocked
                  ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                  : 'bg-slate-950/60 border-slate-900 opacity-60 cursor-not-allowed'
              }`}
            >
              {/* Top Row: Icon & Status */}
              <div className="flex items-start justify-between w-full mb-2">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner"
                  style={{
                    backgroundColor: `${world.themeColor}25`,
                    border: `1px solid ${world.themeColor}50`,
                  }}
                >
                  {world.icon}
                </div>

                {isCompleted ? (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Hecho
                  </span>
                ) : !isUnlocked ? (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" /> {world.requiredXp} XP
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-400 font-mono font-bold">
                    ⭐ {progress?.stars || 0}/3
                  </span>
                )}
              </div>

              {/* Title & Info */}
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-100 font-['Baloo_2'] leading-snug group-hover:text-amber-300 transition-colors">
                  {world.name}
                </h4>
                <p className="text-[11px] text-slate-400 leading-tight line-clamp-1 mt-0.5">
                  {world.subtitle}
                </p>
                <p className="text-[10px] text-slate-500 line-clamp-1 mt-1 font-mono">
                  {world.targetConcept}
                </p>
              </div>

              {/* Bottom tag / Action */}
              <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                <span className="text-slate-400">{world.mode.toUpperCase()}</span>
                {isSelected ? (
                  <span className="text-amber-400 font-bold">Jugando</span>
                ) : isUnlocked ? (
                  <span className="text-blue-400 flex items-center group-hover:translate-x-0.5 transition-transform">
                    Viajar <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                ) : (
                  <span className="text-slate-500">Bloqueado</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
