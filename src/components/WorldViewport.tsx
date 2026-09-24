import React, { useState } from 'react';
import { ThreeWorldCanvas } from './ThreeWorldCanvas';
import { IllustratedWorldViewport } from './IllustratedWorldViewport';
import { DynamicParticleSystem } from './DynamicParticleSystem';
import { GameMode, MathQuestion, RegionDefinition } from '../types';
import { REGIONS } from '../data/regionsData';
import { DynamicParticleSystem } from './DynamicParticleSystem';
import { Eye, Layers, Compass, ArrowLeft } from 'lucide-react';

interface WorldViewportProps {
  viewMode: 'map' | 'game';
  currentRegionId: string;
  gameMode: GameMode;
  questionIndex: number;
  totalQuestions: number;
  isCorrect: boolean | null;
  heroHp: number;
  enemyHp: number;
  bridgeBuiltSegments: number;
  raceProgress?: number;
  shopCartTotal?: number;
  cluesFound?: number;
  gameWon?: boolean;
  gameOver?: boolean;
  combo: number;
  gameWon?: boolean;
  gameOver?: boolean;
  activeQuestion: MathQuestion | null;
  onSelectRegion: (regionId: string) => void;
  onToggleViewMode: () => void;
}

export const WorldViewport: React.FC<WorldViewportProps> = ({
  viewMode,
  currentRegionId,
  gameMode,
  questionIndex,
  totalQuestions,
  isCorrect,
  heroHp,
  enemyHp,
  bridgeBuiltSegments,
  raceProgress = 0,
  shopCartTotal = 0,
  cluesFound = 0,
  gameWon = false,
  gameOver = false,
  combo,
  gameWon = false,
  gameOver = false,
  activeQuestion,
  onSelectRegion,
  onToggleViewMode,
}) => {
  // Engine: 'three' (WebGL 3D) or 'illustrated' (Crisp SVG/Isometric from user files)
  const [engine, setEngine] = useState<'three' | 'illustrated'>('illustrated');
  const [webGLError, setWebGLError] = useState(false);

  const currentRegion: RegionDefinition =
    REGIONS.find((w) => w.id === currentRegionId) || REGIONS[0];

  const handleToggleEngine = () => {
    if (engine === 'three') {
      setEngine('illustrated');
    } else {
      if (!webGLError) {
        setEngine('three');
      } else {
        alert('El modo 3D WebGL no está disponible en este navegador, mantendremos el Modo Ilustrado.');
      }
    }
  };

  return (
    <div className="relative w-full">
      {/* Top Floating Controls Bar */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-auto">
        {/* Left: Current World or Map Badge */}
        <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-full text-xs font-bold text-slate-200 shadow-lg">
          {viewMode === 'map' ? (
            <>
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              <span>Mapa de las 4 Regiones</span>
            </>
          ) : (
            <>
              <span>{currentRegion.icon}</span>
              <span className="font-['Baloo_2']">{currentRegion.name}</span>
              <span className="text-[10px] text-slate-400 hidden sm:inline">({currentRegion.competency})</span>
            </>
          )}
        </div>

        {/* Right: Engine Switcher & Map Toggle */}
        <div className="flex items-center gap-2">
          {/* Dual-Engine Toggle Button */}
          <button
            id="engine-toggle-btn"
            onClick={handleToggleEngine}
            className="flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-amber-400/60 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-lg active:scale-95 cursor-pointer"
            title="Alterna entre el Modo 3D WebGL y el Modo Ilustrado fiel a los archivos HTML"
          >
            {engine === 'three' ? (
              <>
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Modo: </span>
                <span className="text-amber-400">3D WebGL</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Modo: </span>
                <span className="text-emerald-300">Ilustrado Fiel</span>
              </>
            )}
          </button>

          {/* Quick Map / Game Switcher */}
          <button
            id="map-game-toggle-btn"
            onClick={onToggleViewMode}
            className="flex items-center gap-1 bg-blue-600/90 hover:bg-blue-500 text-white border border-blue-400 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-lg active:scale-95 cursor-pointer"
          >
            {viewMode === 'map' ? (
              <>
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a Jugar</span>
              </>
            ) : (
              <>
                <Compass className="w-3.5 h-3.5" />
                <span>Ver Mapa</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Render Active Viewport Engine */}
      {engine === 'three' && !webGLError ? (
        <ThreeWorldCanvas
          viewMode={viewMode}
          currentRegionId={currentRegionId}
          gameMode={gameMode}
          questionIndex={questionIndex}
          totalQuestions={totalQuestions}
          isCorrect={isCorrect}
          heroHp={heroHp}
          enemyHp={enemyHp}
          bridgeBuiltSegments={bridgeBuiltSegments}
          raceProgress={raceProgress}
          shopCartTotal={shopCartTotal}
          cluesFound={cluesFound}
          gameWon={gameWon}
          gameOver={gameOver}
          onSelectRegion={onSelectRegion}
          onWebGLError={() => {
            setWebGLError(true);
            setEngine('illustrated');
          }}
        />
      ) : (
        <IllustratedWorldViewport
          viewMode={viewMode}
          currentRegionId={currentRegionId}
          gameMode={gameMode}
          questionIndex={questionIndex}
          totalQuestions={totalQuestions}
          isCorrect={isCorrect}
          heroHp={heroHp}
          enemyHp={enemyHp}
          bridgeBuiltSegments={bridgeBuiltSegments}
          raceProgress={raceProgress}
          shopCartTotal={shopCartTotal}
          cluesFound={cluesFound}
          combo={combo}
          gameWon={gameWon}
          gameOver={gameOver}
          activeQuestion={activeQuestion}
          onSelectRegion={onSelectRegion}
        />
      )}

      {/* Capa de partículas (reacciona a aciertos, combos, victoria/derrota) */}
      <DynamicParticleSystem
        gameMode={gameMode}
        isCorrect={isCorrect}
        gameWon={gameWon}
        gameOver={gameOver}
        combo={combo}
        raceProgress={raceProgress}
        shopCartTotal={shopCartTotal}
        questionIndex={questionIndex}
      />
    </div>
  );
};
