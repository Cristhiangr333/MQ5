import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WORLDS, generateQuestionsForWorld } from './data/worldsData';
import { WorldDefinition, PlayerStats, GameSessionState } from './types';
import { playSfx, toggleAudioMute, getIsMuted } from './utils/audio';
import { WorldViewport } from './components/WorldViewport';
import { GameHUD } from './components/GameHUD';
import { QuestionPanel } from './components/QuestionPanel';
import { WorldCardStrip } from './components/WorldCardStrip';
import { TeacherReportModal } from './components/TeacherReportModal';
import { GameOverModal } from './components/GameOverModal';
import { Play, Compass, Sparkles, BookOpen, Volume2, Shield } from 'lucide-react';

const QUESTIONS_PER_WORLD = 5;
const MAX_LIVES = 3;
const TIME_PER_QUESTION_MS = 8000;

export default function App() {
  const [viewMode, setViewMode] = useState<'map' | 'game'>('game');
  const [currentWorldId, setCurrentWorldId] = useState<string>('bosque');
  const [isMuted, setIsMuted] = useState<boolean>(getIsMuted());
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);

  // Persistent Player Stats
  const [stats, setStats] = useState<PlayerStats>(() => {
    return {
      score: 0,
      stars: 3,
      xp: 40,
      lives: MAX_LIVES,
      maxLives: MAX_LIVES,
      combo: 0,
      highestCombo: 0,
      worldProgress: {
        bosque: { completed: false, highScore: 0, stars: 0, questionsAnswered: 0, correctAnswers: 0 },
        montana: { completed: false, highScore: 0, stars: 0, questionsAnswered: 0, correctAnswers: 0 },
        ciudad: { completed: false, highScore: 0, stars: 0, questionsAnswered: 0, correctAnswers: 0 },
        rio: { completed: false, highScore: 0, stars: 0, questionsAnswered: 0, correctAnswers: 0 },
        castillo: { completed: false, highScore: 0, stars: 0, questionsAnswered: 0, correctAnswers: 0 },
      },
      totalCorrect: 0,
      totalAnswered: 0,
    };
  });

  // Active Session State
  const [session, setSession] = useState<GameSessionState>(() => {
    const initialQuestions = generateQuestionsForWorld('bosque', QUESTIONS_PER_WORLD);
    return {
      currentWorldId: 'bosque',
      activeQuestionIndex: 0,
      totalQuestions: QUESTIONS_PER_WORLD,
      questions: initialQuestions,
      isAnswered: false,
      selectedOption: null,
      isCorrect: null,
      timeLeft: TIME_PER_QUESTION_MS,
      maxTime: TIME_PER_QUESTION_MS,
      isTimerActive: true,
      feedbackText: '',
      gameOver: false,
      gameWon: false,
      raceProgress: 0,
      heroHp: 100,
      enemyHp: 100,
      bridgeBuiltSegments: 0,
      shopCartTotal: 0,
      cluesFound: 0,
    };
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentWorld: WorldDefinition =
    WORLDS.find((w) => w.id === currentWorldId) || WORLDS[0];

  // Start or restart a world session
  const initWorldSession = useCallback((worldId: string) => {
    const questions = generateQuestionsForWorld(worldId, QUESTIONS_PER_WORLD);
    setCurrentWorldId(worldId);
    setViewMode('game');
    setSession({
      currentWorldId: worldId,
      activeQuestionIndex: 0,
      totalQuestions: QUESTIONS_PER_WORLD,
      questions,
      isAnswered: false,
      selectedOption: null,
      isCorrect: null,
      timeLeft: TIME_PER_QUESTION_MS,
      maxTime: TIME_PER_QUESTION_MS,
      isTimerActive: true,
      feedbackText: '',
      gameOver: false,
      gameWon: false,
      raceProgress: 0,
      heroHp: 100,
      enemyHp: 100,
      bridgeBuiltSegments: 0,
      shopCartTotal: 0,
      cluesFound: 0,
    });
    setStats((prev) => ({ ...prev, lives: MAX_LIVES, combo: 0 }));
  }, []);

  // Answer handler
  const handleSelectOption = useCallback(
    (option: number | string | null) => {
      if (session.isAnswered || session.gameOver || session.gameWon) return;

      const currentQ = session.questions[session.activeQuestionIndex];
      if (!currentQ) return;

      const correct = option !== null && option === currentQ.correct;

      // Update HP / game specific progression
      let newHeroHp = session.heroHp;
      let newEnemyHp = session.enemyHp;
      let newBridge = session.bridgeBuiltSegments;
      let newClues = session.cluesFound;
      let newRaceProgress = session.raceProgress;
      let newShopCartTotal = session.shopCartTotal;

      if (correct) {
        if (currentWorld.mode === 'race') {
          // Advance on track by 20%
          newRaceProgress = Math.min(100, (session.raceProgress || 0) + 20);
        } else if (currentWorld.mode === 'battle') {
          newEnemyHp = Math.max(0, session.enemyHp - 25);
        } else if (currentWorld.mode === 'shop') {
          newShopCartTotal = (session.shopCartTotal || 0) + 1;
        } else if (currentWorld.mode === 'bridge') {
          newBridge = Math.min(QUESTIONS_PER_WORLD, session.bridgeBuiltSegments + 1);
        } else if (currentWorld.mode === 'detective') {
          newClues = Math.min(5, session.cluesFound + 1);
        }
      } else {
        if (currentWorld.mode === 'race') {
          // Retroceder de verdad si pierde: retrocede 14%
          newRaceProgress = Math.max(0, (session.raceProgress || 0) - 14);
        } else if (currentWorld.mode === 'battle') {
          newHeroHp = Math.max(0, session.heroHp - 20);
        }
      }

      // Update Player Stats
      setStats((prev) => {
        const newCombo = correct ? prev.combo + 1 : 0;
        const highestCombo = Math.max(prev.highestCombo, newCombo);
        const newLives = correct ? prev.lives : Math.max(0, prev.lives - 1);
        const comboBonus = Math.min(newCombo, 4) * 5;
        const ptsGained = correct ? 20 + comboBonus : 0;
        const newScore = prev.score + ptsGained;
        const newXp = prev.xp + (correct ? 15 : 0);

        const currentProg = prev.worldProgress[currentWorldId] || {
          completed: false,
          highScore: 0,
          stars: 0,
          questionsAnswered: 0,
          correctAnswers: 0,
        };

        const updatedProgress = {
          ...prev.worldProgress,
          [currentWorldId]: {
            ...currentProg,
            questionsAnswered: currentProg.questionsAnswered + 1,
            correctAnswers: currentProg.correctAnswers + (correct ? 1 : 0),
            highScore: Math.max(currentProg.highScore, newScore),
          },
        };

        return {
          ...prev,
          score: newScore,
          xp: newXp,
          lives: newLives,
          combo: newCombo,
          highestCombo,
          totalAnswered: prev.totalAnswered + 1,
          totalCorrect: prev.totalCorrect + (correct ? 1 : 0),
          worldProgress: updatedProgress,
        };
      });

      // Audio feedback
      if (correct) {
        if (stats.combo >= 2) {
          playSfx('combo');
        } else {
          playSfx('correct');
        }
      } else {
        playSfx('wrong');
      }

      const feedback = correct
        ? `¡Correcto! +20 puntos${stats.combo >= 1 ? ` · Combo x${Math.min(stats.combo + 1, 4)}` : ''}`
        : option === null
        ? `¡Se agotó el tiempo! La respuesta correcta era ${currentQ.correct}.`
        : `Casi. La respuesta correcta era ${currentQ.correct}.`;

      setSession((prev) => ({
        ...prev,
        isAnswered: true,
        selectedOption: option,
        isCorrect: correct,
        isTimerActive: false,
        feedbackText: feedback,
        raceProgress: newRaceProgress,
        heroHp: newHeroHp,
        enemyHp: newEnemyHp,
        bridgeBuiltSegments: newBridge,
        cluesFound: newClues,
        shopCartTotal: newShopCartTotal,
      }));

      // Check next question or endgame
      setTimeout(() => {
        setSession((prev) => {
          const nextIndex = prev.activeQuestionIndex + 1;
          const isOutLives = !correct && stats.lives - 1 <= 0;
          const isFinished = nextIndex >= QUESTIONS_PER_WORLD;

          if (isOutLives) {
            playSfx('gameover');
            return { ...prev, gameOver: true, isTimerActive: false };
          }

          if (isFinished) {
            playSfx('victory');
            // Mark world completed
            setStats((s) => ({
              ...s,
              worldProgress: {
                ...s.worldProgress,
                [currentWorldId]: {
                  ...s.worldProgress[currentWorldId],
                  completed: true,
                  stars: 3,
                },
              },
            }));
            return { ...prev, gameWon: true, isTimerActive: false };
          }

          return {
            ...prev,
            activeQuestionIndex: nextIndex,
            isAnswered: false,
            selectedOption: null,
            isCorrect: null,
            timeLeft: TIME_PER_QUESTION_MS,
            isTimerActive: true,
            feedbackText: '',
          };
        });
      }, 1400);
    },
    [session, currentWorld, stats.combo, stats.lives, currentWorldId]
  );

  // Timer Tick Effect
  useEffect(() => {
    if (viewMode !== 'game' || !session.isTimerActive || session.isAnswered || session.gameOver || session.gameWon) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSession((prev) => {
        if (!prev.isTimerActive || prev.isAnswered) return prev;
        const newTime = prev.timeLeft - 100;
        if (newTime <= 0) {
          clearInterval(timerRef.current!);
          handleSelectOption(null);
          return { ...prev, timeLeft: 0, isTimerActive: false };
        }
        return { ...prev, timeLeft: newTime };
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [viewMode, session.isTimerActive, session.isAnswered, session.gameOver, session.gameWon, handleSelectOption]);

  // Keyboard Shortcuts (1, 2, 3 to answer, M for map)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        setViewMode((v) => (v === 'map' ? 'game' : 'map'));
      } else if (e.key === 's' || e.key === 'S') {
        setIsMuted(toggleAudioMute());
      } else if (e.key === 'v' || e.key === 'V') {
        const btn = document.getElementById('engine-toggle-btn');
        if (btn) btn.click();
      } else if (['1', '2', '3'].includes(e.key) && viewMode === 'game' && !session.isAnswered) {
        const idx = parseInt(e.key) - 1;
        const q = session.questions[session.activeQuestionIndex];
        if (q && q.options[idx] !== undefined) {
          handleSelectOption(q.options[idx]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, session, handleSelectOption]);

  const activeQuestion = session.questions[session.activeQuestionIndex] || null;

  // Next world helper
  const handleNextWorld = () => {
    const currentIndex = WORLDS.findIndex((w) => w.id === currentWorldId);
    const nextIndex = (currentIndex + 1) % WORLDS.length;
    initWorldSession(WORLDS[nextIndex].id);
  };

  return (
    <div className="min-h-screen bg-[#142138] text-slate-100 flex flex-col items-center justify-start p-3 sm:p-5 md:p-6 font-['Nunito_Sans',sans-serif]">
      {/* Cabinet Container */}
      <main className="w-full max-w-4xl flex flex-col gap-4">
        {/* Top HUD */}
        <GameHUD
          currentWorld={currentWorld}
          viewMode={viewMode}
          questionIndex={session.activeQuestionIndex}
          totalQuestions={session.totalQuestions}
          score={stats.score}
          lives={stats.lives}
          maxLives={stats.maxLives}
          combo={stats.combo}
          isMuted={isMuted}
          onToggleSound={() => setIsMuted(toggleAudioMute())}
          onOpenMap={() => setViewMode((v) => (v === 'map' ? 'game' : 'map'))}
          onOpenReport={() => setIsReportOpen(true)}
          onResetGame={() => initWorldSession(currentWorldId)}
        />

        {/* World Viewport (Dual-Engine: 3D WebGL / Modo Ilustrado Fiel) */}
        <section className="relative w-full">
          <WorldViewport
            viewMode={viewMode}
            currentWorldId={currentWorldId}
            gameMode={currentWorld.mode}
            questionIndex={session.activeQuestionIndex}
            totalQuestions={session.totalQuestions}
            isCorrect={session.isCorrect}
            heroHp={session.heroHp}
            enemyHp={session.enemyHp}
            bridgeBuiltSegments={session.bridgeBuiltSegments}
            raceProgress={session.raceProgress}
            shopCartTotal={session.shopCartTotal}
            cluesFound={session.cluesFound}
            combo={stats.combo}
            activeQuestion={activeQuestion}
            onSelectWorld={(id) => {
              playSfx('click');
              initWorldSession(id);
            }}
            onToggleViewMode={() => setViewMode((v) => (v === 'map' ? 'game' : 'map'))}
          />
        </section>

        {/* Dynamic Lower Area: Either Question Panel or World Map Explainer */}
        {viewMode === 'game' ? (
          <QuestionPanel
            question={activeQuestion}
            timeLeft={session.timeLeft}
            maxTime={session.maxTime}
            isAnswered={session.isAnswered}
            selectedOption={session.selectedOption}
            isCorrect={session.isCorrect}
            combo={stats.combo}
            feedbackText={session.feedbackText}
            onSelectOption={handleSelectOption}
            gameMode={currentWorld.mode}
          />
        ) : (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-center backdrop-blur-md">
            <h3 className="text-xl font-extrabold font-['Baloo_2'] text-white flex items-center justify-center gap-2">
              <Compass className="w-5 h-5 text-amber-400" />
              <span>Explorador del Archipiélago Matemático 3D</span>
            </h3>
            <p className="text-sm text-slate-300 max-w-lg mx-auto mt-2 leading-relaxed">
              Interactúa con el modelo 3D arriba arrastrando con el ratón o el dedo para rotar la cámara.
              Haz clic en cualquier isla o selecciona uno de los mundos abajo para comenzar a jugar.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setViewMode('game')}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-sm text-white flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
              >
                <Play className="w-4 h-4" />
                <span>Continuar Jugando: {currentWorld.name}</span>
              </button>
            </div>
          </div>
        )}

        {/* 5 Worlds Navigation Cards Strip */}
        <WorldCardStrip
          currentWorldId={currentWorldId}
          stats={stats}
          onSelectWorld={(worldId) => {
            playSfx('click');
            initWorldSession(worldId);
          }}
        />

        {/* Pedagogical Footer Note */}
        <footer className="text-center text-xs text-slate-500 py-3 flex flex-wrap items-center justify-center gap-3 border-t border-slate-800/60">
          <span>🎮 MathQuest 5 · Para estudiantes de quinto grado</span>
          <span>·</span>
          <span>⌨️ Atajos: Teclas [1, 2, 3] para responder · [M] Mapa 3D · [S] Sonido</span>
          <span>·</span>
          <button
            onClick={() => setIsReportOpen(true)}
            className="text-blue-400 hover:underline flex items-center gap-1"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Ver reporte docente</span>
          </button>
        </footer>
      </main>

      {/* Teacher / Learning Report Modal */}
      <TeacherReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        stats={stats}
      />

      {/* Game Over / Victory Modal */}
      <GameOverModal
        isOpen={session.gameOver || session.gameWon}
        isWon={session.gameWon}
        score={stats.score}
        xpGained={session.gameWon ? 50 : 15}
        correctCount={stats.worldProgress[currentWorldId]?.correctAnswers || 0}
        totalCount={session.totalQuestions}
        currentWorld={currentWorld}
        onReplay={() => initWorldSession(currentWorldId)}
        onGoToMap={() => {
          setViewMode('map');
          setSession((s) => ({ ...s, gameOver: false, gameWon: false }));
        }}
        onNextWorld={session.gameWon ? handleNextWorld : undefined}
      />
    </div>
  );
}
