import React, { useState } from 'react';
import { CloudRain, Sun, Wind, Flame, Sparkles, Eye, EyeOff, Compass } from 'lucide-react';

export type WeatherIntensity = 'normal' | 'soft' | 'off';

interface WeatherOverlayProps {
  worldId: string;
  viewMode: 'map' | 'game';
  intensity?: WeatherIntensity;
  onToggleIntensity?: () => void;
  showBadge?: boolean;
}

export interface WeatherInfo {
  name: string;
  condition: string;
  icon: string;
  color: string;
  description: string;
}

export function getWeatherInfo(worldId: string, viewMode: 'map' | 'game'): WeatherInfo {
  if (viewMode === 'map') {
    return {
      name: 'Espacio Celestial',
      condition: 'Velo Cósmico y Polvo Estelar',
      icon: '🪐',
      color: 'text-sky-300',
      description: 'Cielo abierto con nebulosas suaves entre las islas',
    };
  }

  switch (worldId) {
    case 'ciudad':
      return {
        name: 'Ciudad de la Multiplicación',
        condition: 'Sol Radiante y Destellos de Feria',
        icon: '☀️',
        color: 'text-amber-300',
        description: 'Destellos prismáticos de sol y calidez de mediodía',
      };
    case 'bosque':
      return {
        name: 'Bosque de la Suma',
        condition: 'Brisa y Rayos de Sol Dorados',
        icon: '🍃',
        color: 'text-emerald-300',
        description: 'Rayos de sol filtrados (Komorebi) y polen flotante',
      };
    case 'montana':
      return {
        name: 'Montaña de la Resta',
        condition: 'Calima Volcánica y Fumarola',
        icon: '🌋',
        color: 'text-orange-400',
        description: 'Ondulación térmica tenue y ascuas incandescentes',
      };
    case 'castillo':
      return {
        name: 'Castillo del Saber',
        condition: 'Aurora Boreal Mística',
        icon: '🌌',
        color: 'text-purple-300',
        description: 'Manto boreal luminiscente y polvo de estrellas arcanas',
      };
    default:
      return {
        name: 'Archipiélago',
        condition: 'Clima Despejado',
        icon: '🌤️',
        color: 'text-blue-300',
        description: 'Brisa templada sobre el paisaje',
      };
  }
}

export const WeatherOverlay: React.FC<WeatherOverlayProps> = ({
  worldId,
  viewMode,
  intensity = 'normal',
}) => {
  if (intensity === 'off') {
    return null;
  }

  const opacityMultiplier = intensity === 'soft' ? 0.5 : 1.0;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden select-none z-10 transition-opacity duration-700"
      style={{ opacity: opacityMultiplier }}
      aria-hidden="true"
    >
      {/* ========================================================================= */}
      {/* 1. MUNDO CIUDAD: DESTELLOS INTENSOS Y SOL DE MEDIODÍA                     */}
      {/* ========================================================================= */}
      {viewMode === 'game' && worldId === 'ciudad' && (
        <div className="absolute inset-0">
          {/* Calidez solar de mediodía */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-amber-400/5 to-yellow-300/12 mix-blend-screen" />
          <div className="absolute inset-0 shadow-[inset_0_0_90px_rgba(245,158,11,0.08)]" />

          {/* Gran resplandor solar / Lens Flare en esquina superior izquierda */}
          <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-gradient-to-br from-amber-200/35 via-yellow-400/20 to-transparent blur-3xl animate-sun-halo" />
          <div className="absolute top-4 left-6 w-24 h-24 rounded-full bg-yellow-100/30 blur-xl animate-sun-halo" />

          {/* Destellos prismáticos cruzados de 4 puntas (Sun Glints) en el mercado */}
          {[
            { top: '16%', left: '28%', size: 'w-6 h-6', delay: '0s' },
            { top: '24%', left: '68%', size: 'w-8 h-8', delay: '-1s' },
            { top: '48%', left: '18%', size: 'w-5 h-5', delay: '-1.8s' },
            { top: '40%', left: '82%', size: 'w-7 h-7', delay: '-0.6s' },
            { top: '65%', left: '50%', size: 'w-5 h-5', delay: '-2.2s' },
            { top: '30%', left: '42%', size: 'w-6 h-6', delay: '-1.4s' },
          ].map((glint, idx) => (
            <div
              key={idx}
              className={`absolute flex items-center justify-center animate-sun-glint pointer-events-none`}
              style={{ top: glint.top, left: glint.left, animationDelay: glint.delay }}
            >
              {/* Eje horizontal */}
              <div className="absolute w-5 h-[1.5px] bg-gradient-to-r from-transparent via-amber-200/90 to-transparent blur-[0.3px]" />
              {/* Eje vertical */}
              <div className="absolute h-5 w-[1.5px] bg-gradient-to-b from-transparent via-amber-200/90 to-transparent blur-[0.3px]" />
              {/* Núcleo brillante */}
              <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(253,224,71,0.9)]" />
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MUNDO BOSQUE: RAYOS DE SOL DORADOS (KOMOREBI) Y BRISA                   */}
      {/* ========================================================================= */}
      {viewMode === 'game' && worldId === 'bosque' && (
        <div className="absolute inset-0">
          {/* Tinte primaveral de copa de árboles */}
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-600/5 via-transparent to-amber-300/10 mix-blend-screen" />
          <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(34,197,94,0.08)]" />

          {/* Rayos Crepusculares de Sol (God Rays) inclinados a través de las ramas */}
          <div className="absolute -top-12 -left-20 w-[140%] h-full pointer-events-none animate-god-rays">
            <div className="w-full h-full flex justify-around opacity-40">
              <div className="w-20 h-full bg-gradient-to-b from-amber-200/30 via-yellow-100/15 to-transparent blur-md transform -skew-x-12" />
              <div className="w-32 h-full bg-gradient-to-b from-amber-100/25 via-emerald-100/10 to-transparent blur-lg transform -skew-x-12" />
              <div className="w-24 h-full bg-gradient-to-b from-yellow-200/20 via-amber-100/10 to-transparent blur-md transform -skew-x-12" />
              <div className="w-36 h-full bg-gradient-to-b from-amber-200/25 via-transparent to-transparent blur-xl transform -skew-x-12" />
            </div>
          </div>

          {/* Motas de polen dorado flotando en suspensión */}
          {[
            { top: '25%', left: '16%', delay: '-1s', size: 'w-2 h-2' },
            { top: '38%', left: '42%', delay: '-3s', size: 'w-1.5 h-1.5' },
            { top: '50%', left: '74%', delay: '-2s', size: 'w-2 h-2' },
            { top: '65%', left: '28%', delay: '-4.5s', size: 'w-1.5 h-1.5' },
            { top: '30%', left: '85%', delay: '-2.5s', size: 'w-2 h-2' },
          ].map((speck, idx) => (
            <span
              key={idx}
              className={`absolute rounded-full bg-amber-300/50 blur-[0.6px] animate-star-twinkle ${speck.size}`}
              style={{ top: speck.top, left: speck.left, animationDelay: speck.delay }}
            />
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MUNDO MONTAÑA: CALIMA TÉRMICA, CALOR VOLCÁNICO Y ASCUAS               */}
      {/* ========================================================================= */}
      {viewMode === 'game' && worldId === 'montana' && (
        <div className="absolute inset-0">
          {/* Tinte ardiente y viñeta ocre */}
          <div className="absolute inset-0 bg-gradient-to-t from-orange-600/12 via-amber-600/5 to-transparent mix-blend-color-dodge" />
          <div className="absolute inset-0 shadow-[inset_0_0_90px_rgba(234,88,12,0.12)]" />

          {/* Ondas de calima térmica sobre el cráter */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-orange-500/15 via-red-500/5 to-transparent blur-2xl animate-heat-shimmer" />

          {/* Ascuas y chispas de fumarola ascendiendo */}
          {[
            { left: '18%', delay: '0s', size: 'w-1.5 h-1.5' },
            { left: '32%', delay: '-1.4s', size: 'w-2 h-2' },
            { left: '48%', delay: '-2.8s', size: 'w-1.5 h-1.5' },
            { left: '62%', delay: '-0.7s', size: 'w-2 h-2' },
            { left: '78%', delay: '-2.1s', size: 'w-1.5 h-1.5' },
            { left: '88%', delay: '-3.5s', size: 'w-2 h-2' },
          ].map((ash, idx) => (
            <span
              key={idx}
              className={`absolute bottom-6 rounded-full bg-orange-400/60 shadow-[0_0_6px_#f97316] animate-ash-rise ${ash.size}`}
              style={{ left: ash.left, animationDelay: ash.delay }}
            />
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MUNDO CASTILLO: AURORA BOREAL MÍSTICA Y POLVO ARCANO                   */}
      {/* ========================================================================= */}
      {viewMode === 'game' && worldId === 'castillo' && (
        <div className="absolute inset-0">
          {/* Velo nocturno celestial profundo */}
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/25 via-transparent to-purple-950/20 mix-blend-overlay" />
          <div className="absolute inset-0 shadow-[inset_0_0_90px_rgba(99,102,241,0.14)]" />

          {/* Velo Ondulante de Aurora Boreal (Luminiscencia mágica superior) */}
          <div className="absolute -top-12 -left-20 w-[140%] h-44 overflow-hidden pointer-events-none">
            <div className="w-full h-full bg-gradient-to-r from-teal-400/20 via-purple-500/25 to-pink-500/20 blur-3xl animate-aurora-drift mix-blend-screen" />
            <div className="absolute top-4 w-full h-32 bg-gradient-to-r from-indigo-400/25 via-cyan-400/20 to-purple-400/25 blur-2xl animate-aurora-drift mix-blend-screen" style={{ animationDirection: 'alternate-reverse' }} />
          </div>

          {/* Destellos de estrellas arcanas y glifos titilantes */}
          {[
            { top: '14%', left: '22%', delay: '0s' },
            { top: '22%', left: '76%', delay: '-1.5s' },
            { top: '35%', left: '15%', delay: '-2.5s' },
            { top: '42%', left: '84%', delay: '-0.8s' },
            { top: '28%', left: '50%', delay: '-3.2s' },
          ].map((star, idx) => (
            <div
              key={idx}
              className="absolute animate-star-twinkle flex items-center justify-center pointer-events-none"
              style={{ top: star.top, left: star.left, animationDelay: star.delay }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-violet-200 shadow-[0_0_8px_#a855f7]" />
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODO MAPA: VELO CÓSMICO Y CONSTELACIONES                               */}
      {/* ========================================================================= */}
      {viewMode === 'map' && (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-radial-gradient from-transparent via-slate-900/10 to-indigo-950/25" />
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl animate-aurora-drift" />
          <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl animate-aurora-drift" style={{ animationDelay: '-6s' }} />
        </div>
      )}
    </div>
  );
};
