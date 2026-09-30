import React, { useState, useEffect } from 'react';
import { RegionDefinition } from '../types';
import { Play, Compass, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface GalaxyUnlockOverlayProps {
  region: RegionDefinition;
  previousRegionName?: string;
  onPlayRegion: () => void;
  onDismiss: () => void;
}

/**
 * Celebración estilo "Mario Galaxy" al desbloquear una región nueva: un
 * candado tiembla y se hace pedazos con confeti, luego aparece el emblema
 * de la región con botones para jugarla ya o volver al mapa.
 * Se muestra sobre el mapa 3D (o el modo ilustrado) sin depender de cuál
 * de los dos motores esté activo -- ver WorldViewport.
 */
export const GalaxyUnlockOverlay: React.FC<GalaxyUnlockOverlayProps> = ({
  region,
  previousRegionName,
  onPlayRegion,
  onDismiss,
}) => {
  const [shattered, setShattered] = useState(false);

  useEffect(() => {
    const shatterTimer = setTimeout(() => {
      setShattered(true);
      try {
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#f59e0b', '#fbbf24', '#38bdf8', '#a855f7', '#ffffff'],
        });
      } catch {
        // Si canvas-confetti no puede montar, seguimos sin bloquear la celebración
      }
    }, 1100);

    return () => clearTimeout(shatterTimer);
  }, []);

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-between p-3 sm:p-5 pointer-events-none select-none overflow-hidden animate-in fade-in duration-500">
      {/* Viñeta cinematográfica y resplandor cósmico ambiental */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-transparent to-slate-950/90 pointer-events-none" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl opacity-35 pointer-events-none animate-pulse"
        style={{ backgroundColor: region.themeColor }}
      />

      {/* Banner superior */}
      <div className="relative z-10 w-full flex flex-col items-center text-center animate-in slide-in-from-top-6 duration-700">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.4)] backdrop-blur-md">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
          <span className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-amber-300 font-['Baloo_2']">
            ¡NUEVA REGIÓN DESBLOQUEADA!
          </span>
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
        </div>

        {previousRegionName && (
          <p className="text-[11px] sm:text-xs text-slate-300 mt-1.5 font-medium drop-shadow-md">
            ¡Has completado con éxito <span className="text-amber-300 font-bold">{previousRegionName}</span>!
          </p>
        )}
      </div>

      {/* Centro: candado que se hace pedazos */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto pointer-events-auto">
        {!shattered ? (
          <div className="flex flex-col items-center animate-bounce" style={{ animationDuration: '0.6s' }}>
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-amber-500/20 border-2 border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.7)] flex items-center justify-center text-5xl backdrop-blur-md animate-pulse">
              <span className="drop-shadow-[0_0_12px_#fbbf24]">🔒</span>
              <div className="absolute inset-0 rounded-3xl border border-white/60 animate-ping opacity-40" />
            </div>
            <span className="mt-2 text-xs font-bold text-amber-200 uppercase tracking-widest bg-slate-900/80 px-3 py-0.5 rounded-full border border-amber-500/40">
              Desbloqueando coordenadas cósmicas...
            </span>
          </div>
        ) : (
          <div
            onClick={onPlayRegion}
            className="flex flex-col items-center cursor-pointer group transform hover:scale-105 transition-all duration-300"
            title="¡Haz clic o toca para jugar esta región ahora!"
          >
            <div
              className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center text-4xl sm:text-5xl shadow-[0_0_40px_rgba(251,191,36,0.6)] backdrop-blur-md border-2 border-white/80 group-hover:border-amber-300 animate-in zoom-in-75 duration-500"
              style={{ backgroundColor: `${region.themeColor}dd` }}
            >
              <span className="drop-shadow-lg group-hover:scale-110 transition-transform">{region.icon}</span>
              <div className="absolute -inset-2 rounded-3xl border-2 border-amber-300/60 animate-spin" style={{ animationDuration: '8s' }} />
              <div className="absolute -inset-4 rounded-full border border-sky-400/40 animate-pulse" />
              <div className="absolute -top-3 -right-3 text-amber-300 text-lg animate-bounce" style={{ animationDelay: '0.1s' }}>
                ⭐
              </div>
              <div className="absolute -bottom-2 -left-3 text-amber-300 text-base animate-bounce" style={{ animationDelay: '0.3s' }}>
                ✨
              </div>
            </div>

            <div className="text-center mt-3 bg-slate-900/90 border border-slate-700/80 px-4 py-2 rounded-2xl shadow-xl backdrop-blur-md max-w-sm">
              <h2 className="text-lg sm:text-xl font-extrabold text-white font-['Baloo_2'] flex items-center justify-center gap-1.5">
                <span>{region.name}</span>
              </h2>
              <p className="text-xs text-amber-300 font-semibold">{region.shortName}</p>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">{region.competency}</p>
            </div>
          </div>
        )}
      </div>

      {/* Controles inferiores */}
      <div className="relative z-10 w-full flex flex-col sm:flex-row items-center justify-center gap-2.5 pointer-events-auto pb-2">
        <button
          onClick={onPlayRegion}
          className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.5)] border border-emerald-300/60 active:scale-95 transition-all transform animate-pulse"
        >
          <Play className="w-5 h-5 fill-white" />
          <span>¡TOCA AQUÍ PARA JUGAR AHORA!</span>
        </button>

        <button
          onClick={onDismiss}
          className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border border-slate-700 backdrop-blur-md transition-colors active:scale-95"
        >
          <Compass className="w-4 h-4 text-sky-400" />
          <span>Ver Todo el Mapa</span>
        </button>
      </div>
    </div>
  );
};
