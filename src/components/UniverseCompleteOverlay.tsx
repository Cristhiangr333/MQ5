import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Compass, RotateCcw, Sparkles } from 'lucide-react';
import { REGIONS } from '../data/regionsData';
import { regionStarTotals } from '../lib/universe';
import { playSfx } from '../utils/audio';
import type { RegionProgress } from '../types';

export interface UniverseCompleteOverlayProps {
  /** Progreso REAL del estudiante (de ahí salen las estrellas de cada región). */
  regions: RegionProgress[];
  totalXp: number;
  /** Cierra el final y deja explorar el mapa. */
  onExplore: () => void;
  /** Reinicia la cinemática desde cero. */
  onReplay: () => void;
  /** Rejugar una región desde su medallón. */
  onPlayRegion: (regionId: string) => void;
}

const PARTY_COLORS = ['#fbbf24', '#f59e0b', '#38bdf8', '#a855f7', '#34d399', '#f43f5e', '#ffffff'];

/** Quien pidió menos movimiento en su sistema no recibe fuegos artificiales. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/**
 * Pantalla del Gran Final: se muestra encima del mapa cuando el estudiante completó las
 * 4 regiones. Es compacta a propósito: el visor mide ~320 px de alto en el móvil, así
 * que la zona central desplaza (scroll) en vez de recortarse. Todo dato sale del progreso
 * real: nada de textos ni estrellas fijos.
 */
export function UniverseCompleteOverlay({
  regions,
  totalXp,
  onExplore,
  onReplay,
  onPlayRegion,
}: UniverseCompleteOverlayProps) {
  const [sparks, setSparks] = useState(0);

  // Cascada de fuegos artificiales al abrir
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const end = Date.now() + 2500;
    const id = setInterval(() => {
      if (Date.now() > end) {
        clearInterval(id);
        return;
      }
      try {
        confetti({
          startVelocity: 30,
          spread: 360,
          ticks: 60,
          origin: { x: Math.random(), y: Math.random() * 0.4 + 0.1 },
          colors: PARTY_COLORS,
        });
      } catch {
        // el confeti es un adorno: si falla, el final sigue funcionando
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  const handleStar = () => {
    setSparks((n) => n + 1);
    playSfx('combo');
    if (prefersReducedMotion()) return;
    try {
      confetti({ particleCount: 50, spread: 90, origin: { y: 0.45 }, colors: PARTY_COLORS.slice(0, 4) });
    } catch {
      // idem
    }
  };

  const conquered = regions.filter((r) => r.levels.length > 0 && r.levels.every((l) => l.bestStars >= 1)).length;
  const total = REGIONS.length;
  const percent = total > 0 ? Math.round((conquered / total) * 100) : 0;

  return (
    <div
      role="region"
      aria-label="Universo matemático completado"
      className="absolute inset-0 z-40 flex flex-col gap-2 p-3 pt-12 sm:p-5 sm:pt-14 pointer-events-none select-none overflow-hidden animate-in fade-in duration-700"
    >
      {/* Viñeta cinematográfica para que el texto se lea sobre el mapa */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/30 to-slate-950/85 pointer-events-none" />

      {/* Cabecera */}
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-slate-900/90 border border-amber-400/80 shadow-[0_0_24px_rgba(251,191,36,0.35)]">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
          <span className="text-[11px] sm:text-sm font-black uppercase tracking-widest text-amber-300 font-['Baloo_2']">
            ¡Gran final!
          </span>
          <Sparkles className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
        </div>
        <h2 className="text-lg sm:text-3xl font-black font-['Baloo_2'] text-white mt-1.5 drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
          👑 ¡Universo matemático completado! 👑
        </h2>
        <p className="text-[11px] sm:text-sm text-amber-200 mt-0.5 max-w-xl font-medium drop-shadow-md">
          Dominaste las {total} regiones y devolviste la energía a la Gran Estrella.
        </p>
      </div>

      {/* Zona central: estrella + medallones. Desplaza si el visor es bajo. */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto pointer-events-auto flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={handleStar}
          aria-label="Gran Estrella: tócala para lanzar fuegos artificiales"
          className="shrink-0 flex flex-col items-center cursor-pointer transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 rounded-2xl"
        >
          <span className="text-4xl sm:text-5xl drop-shadow-[0_0_16px_rgba(251,191,36,1)]" aria-hidden="true">
            🌟
          </span>
          <span className="mt-1 text-[10px] sm:text-xs font-mono font-bold text-amber-300 bg-slate-900/90 px-3 py-0.5 rounded-full border border-amber-500/40">
            {sparks > 0 ? `✨ ${sparks} ${sparks === 1 ? 'chispa' : 'chispas'}` : '👆 ¡Toca la Gran Estrella!'}
          </span>
        </button>

        <div className="w-full max-w-xl rounded-2xl bg-slate-900/90 border border-slate-700/80 p-2.5 sm:p-3 backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-300 border-b border-slate-800 pb-1.5 mb-2 font-mono">
            <span className="text-amber-400 font-bold">
              {conquered} de {total} regiones conquistadas ({percent}%)
            </span>
            <span className="text-emerald-400 font-bold">XP total: {totalXp}</span>
          </div>

          <ul className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center">
            {REGIONS.map((region) => {
              const progress = regions.find((r) => r.regionId === region.id);
              const totals = progress ? regionStarTotals(progress) : { stars: 0, max: 0 };
              return (
                <li key={region.id}>
                  <button
                    type="button"
                    onClick={() => onPlayRegion(region.id)}
                    title={`Jugar de nuevo: ${region.name}`}
                    aria-label={`Jugar de nuevo ${region.name}: ${totals.stars} de ${totals.max} estrellas`}
                    className="w-full flex flex-col items-center p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-amber-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    <span className="text-lg sm:text-xl" aria-hidden="true">{region.icon}</span>
                    <span className="text-[10px] font-bold text-slate-200 mt-0.5 line-clamp-1 font-['Baloo_2']">
                      {region.shortName}
                    </span>
                    <span className="text-[9px] text-amber-400 font-mono">
                      ⭐ {totals.stars}/{totals.max}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="hidden sm:block mt-2 pt-2 border-t border-slate-800/80 text-center text-[11px] text-slate-400">
            Sumas, restas, multiplicaciones y divisiones de 1 cifra: ¡todo dominado!
          </p>
        </div>
      </div>

      {/* Acciones */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={onExplore}
          className="px-4 py-2 min-h-10 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Compass className="w-4 h-4" aria-hidden="true" />
          <span>Explorar el mapa</span>
        </button>
        <button
          type="button"
          onClick={onReplay}
          className="px-4 py-2 min-h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 font-bold text-xs sm:text-sm flex items-center gap-1.5 border border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          <span>Repetir la cinemática</span>
        </button>
      </div>
    </div>
  );
}
