import React, { useState, useEffect, useCallback, useRef } from 'react';
import { REGIONS, findRegion, findGameMode } from './data/regionsData';
import { fetchProgress, fetchQuestionsForLevel, submitRound } from './lib/game';
import { GameMode, GameSessionState, PlayerStats, RegionProgress, LevelDisplayInfo } from './types';
import { playSfx, toggleAudioMute, getIsMuted } from './utils/audio';
import { WorldViewport } from './components/WorldViewport';
import { GameHUD } from './components/GameHUD';
import { QuestionPanel } from './components/QuestionPanel';
import { RegionLevelStrip } from './components/RegionLevelStrip';
import { GameOverModal } from './components/GameOverModal';
import { GameModeTutorial } from './components/GameModeTutorial';
import { PauseModal } from './components/PauseModal';
import { detectNewlyUnlocked } from './lib/unlocks';
import { useUnlockCelebrations } from './lib/useUnlockCelebrations';
import { useDelayedFlag } from './lib/useDelayedFlag';
import { Play, Compass, LogOut, Loader2, AlertTriangle } from 'lucide-react';

const MAX_LIVES = 3;
const TIME_PER_QUESTION_MS = 12000;
// Pausa antes de mostrar el modal de victoria, para que se vea la animación 3D de la meta.
const WIN_MODAL_DELAY_MS = 1800;
// Respuesta imposible: marca la pregunta como respondida (mal) cuando se agota el
// tiempo, para que la ronda cuente como "completa" ante submit_round (ver ADR-007).
const TIMEOUT_SENTINEL_ANSWER = -1;
// Un tutorial de "así se juega" por tipo de juego, solo la primera vez que un
// estudiante entra a cada uno (persiste en este navegador/dispositivo).
const TUTORIAL_SEEN_KEY = 'mq5_tutorial_seen_v1';

function loadSeenTutorials(): Set<GameMode> {
  try {
    const raw = window.localStorage.getItem(TUTORIAL_SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set(); // localStorage no disponible (privado/incógnito): no bloquea el juego
  }
}

function markTutorialSeen(gameModeId: GameMode) {
  try {
    const seen = loadSeenTutorials();
    seen.add(gameModeId);
    window.localStorage.setItem(TUTORIAL_SEEN_KEY, JSON.stringify(Array.from(seen)));
  } catch {
    // Si no se puede guardar, el tutorial simplemente volverá a aparecer la próxima vez. No es grave.
  }
}

function emptySession(regionId: string, gameModeId: GameMode): GameSessionState {
  return {
    regionId,
    gameModeId,
    activeQuestionIndex: 0,
    totalQuestions: 0,
    questions: [],
    answers: [],
    isAnswered: false,
    selectedOption: null,
    isCorrect: null,
    timeLeft: TIME_PER_QUESTION_MS,
    maxTime: TIME_PER_QUESTION_MS,
    isTimerActive: false,
    feedbackText: '',
    gameOver: false,
    gameWon: false,
    isSubmitting: false,
    submitError: null,
    xpEarned: null,
    raceProgress: 0,
    heroHp: 100,
    enemyHp: 100,
    bridgeBuiltSegments: 0,
    shopCartTotal: 0,
    cluesFound: 0,
  };
}

/** El nivel a retomar al entrar a una región desde el mapa: el primer sin 3 estrellas. */
function pickResumeLevel(region: RegionProgress | undefined): GameMode {
  if (!region || region.levels.length === 0) return 'race';
  const unlocked = region.levels.filter((l) => l.unlocked);
  const notMastered = unlocked.find((l) => l.bestStars < 3);
  return (notMastered ?? unlocked[unlocked.length - 1] ?? region.levels[0]).gameModeId;
}

interface AppProps {
  playerName?: string;
  courseName?: string;
  onExit?: () => void;
}

export default function App({ playerName, courseName, onExit }: AppProps = {}) {
  const [viewMode, setViewMode] = useState<'map' | 'game'>('map');
  const [isMuted, setIsMuted] = useState<boolean>(getIsMuted());

  // Progreso real (4 regiones × 5 niveles) leído de get_my_progress()
  const [regionsProgress, setRegionsProgress] = useState<RegionProgress[]>([]);
  const [totalXp, setTotalXp] = useState(0);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState<string | null>(null);

  const [currentRegionId, setCurrentRegionId] = useState<string>('bosque');
  const [currentGameModeId, setCurrentGameModeId] = useState<GameMode>('race');

  const [stats, setStats] = useState<PlayerStats>({
    totalXp: 0,
    score: 0,
    lives: MAX_LIVES,
    maxLives: MAX_LIVES,
    combo: 0,
    highestCombo: 0,
  });

  const [session, setSession] = useState<GameSessionState>(() => emptySession('bosque', 'race'));
  const [levelLoading, setLevelLoading] = useState(false);
  const [levelError, setLevelError] = useState<string | null>(null);
  // Si no es null, hay un tutorial de "así se juega" bloqueando la pantalla
  // (primera vez que este dispositivo entra a este tipo de juego).
  const [tutorialGameMode, setTutorialGameMode] = useState<GameMode | null>(null);
  // Pausa manual: detiene el cronómetro sin tocar el resto del estado de la ronda.
  const [isPaused, setIsPaused] = useState(false);
  // Id de la región recién desbloqueada mientras dura la celebración "Mario
  // Galaxy" sobre el mapa (null = no hay ninguna celebración activa).
  // Celebraciones de "región desbloqueada": cola + visualización (ver useUnlockCelebrations).
  // Se muestran solo en el mapa y sin el modal de resultado abierto, venga el jugador por
  // la ruta que venga (botón, tecla M, pausa...).
  const {
    current: unlocking,
    enqueue: enqueueUnlock,
    dismiss: dismissUnlock,
  } = useUnlockCelebrations(viewMode === 'map' && !session.gameOver && !session.gameWon, () => playSfx('unlock'));
  const unlockingRegionId = unlocking?.regionId ?? null;
  const completedRegionName = unlocking?.fromRegionName;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);

  const currentRegion = findRegion(currentRegionId);
  const currentGameMode = findGameMode(currentGameModeId);

  const loadProgress = useCallback(async () => {
    setProgressLoading(true);
    setProgressError(null);
    try {
      const { regions, totalXp: xp } = await fetchProgress();
      setRegionsProgress(regions);
      setTotalXp(xp);
      setStats((prev) => ({ ...prev, totalXp: xp }));
      return regions;
    } catch (err) {
      setProgressError(err instanceof Error ? err.message : 'No pudimos cargar tu progreso.');
      return null;
    } finally {
      setProgressLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  // Carga las preguntas reales del nivel y arranca la ronda
  const initLevelSession = useCallback(async (regionId: string, gameModeId: GameMode) => {
    // currentRegionId/gameMode/viewMode cambian YA -- eso es lo que dispara
    // la reconstrucción completa de la escena 3D (ver ThreeWorldCanvas). Esa
    // reconstrucción lee heroHp/enemyHp/bridgeBuiltSegments/gameWon/gameOver
    // de `session` en ese mismo instante para armar la posición inicial de
    // personajes y la cámara. Si dejamos `session` con los valores de la
    // ronda ANTERIOR hasta que responda Supabase (como estaba antes), la
    // escena se arma mal desde el arranque: personaje del puente en la
    // posición vieja, confeti/cámara de victoria si el nivel anterior se
    // había ganado, personajes de batalla con la vida vieja -- y como esa
    // reconstrucción ocurre una sola vez, queda así hasta que algo vuelva a
    // cambiar region/modo/viewMode (por eso "salir y volver a entrar" lo
    // arreglaba). Por eso limpiamos session ya mismo, sin esperar la red.
    setSession(emptySession(regionId, gameModeId));
    setCurrentRegionId(regionId);
    setCurrentGameModeId(gameModeId);
    setViewMode('game');
    setLevelLoading(true);
    setLevelError(null);
    setIsPaused(false);
    submittedRef.current = false;
    try {
      const { questions, config } = await fetchQuestionsForLevel(regionId, gameModeId);
      if (questions.length === 0) {
        setLevelError('Todavía no hay preguntas cargadas para este nivel. Avísale a tu docente.');
        setLevelLoading(false);
        return;
      }
      const maxTime = config.secondsPerQuestion * 1000;
      const isFirstTimeForThisMode = !loadSeenTutorials().has(gameModeId);
      // Ya no se pisa la sesión entera: solo se agregan los campos que
      // dependen de la respuesta del servidor, para no perder el reseteo
      // inmediato de arriba si el jugador alcanzó a interactuar mientras
      // tanto (poco probable, pero gratis de proteger).
      setSession((prev) => ({
        ...prev,
        totalQuestions: questions.length,
        questions,
        timeLeft: maxTime,
        maxTime,
        isTimerActive: !isFirstTimeForThisMode,
      }));
      setTutorialGameMode(isFirstTimeForThisMode ? gameModeId : null);
      setStats((prev) => ({ ...prev, lives: config.lives, maxLives: config.lives, combo: 0, score: 0 }));
    } catch (err) {
      setLevelError(err instanceof Error ? err.message : 'No pudimos cargar las preguntas de este nivel.');
    } finally {
      setLevelLoading(false);
    }
  }, []);

  // Al elegir una región desde el mapa 3D: retoma el nivel más avanzado sin dominar
  const handleSelectRegion = useCallback(
    (regionId: string) => {
      const region = regionsProgress.find((r) => r.regionId === regionId);
      if (region && !region.unlocked) return; // región bloqueada: no hacer nada
      const gameModeId = pickResumeLevel(region);
      playSfx('click');
      dismissUnlock();
      void initLevelSession(regionId, gameModeId);
    },
    [regionsProgress, initLevelSession, dismissUnlock],
  );

  // Al elegir un nivel específico desde la tira región/nivel
  const handleSelectLevel = useCallback(
    (regionId: string, gameModeId: GameMode) => {
      playSfx('click');
      dismissUnlock();
      void initLevelSession(regionId, gameModeId);
    },
    [initLevelSession],
  );

  // Envía la ronda terminada a submit_round() y refresca el progreso real
  const finishRound = useCallback(
    async (finalAnswers: { question_id: number; answer: number }[]) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSession((prev) => ({ ...prev, isSubmitting: true, submitError: null }));
      // Foto del progreso ANTES de guardar, para comparar contra lo que
      // devuelva loadProgress() y detectar si esta ronda desbloqueó una
      // región nueva (el servidor decide el umbral de XP, no nosotros).
      const previouslyUnlocked = new Set(regionsProgress.filter((r) => r.unlocked).map((r) => r.regionId));
      const completedRegionNameSnapshot = currentRegion.name;
      try {
        const result = await submitRound(currentRegionId, currentGameModeId, finalAnswers);
        setStats((prev) => ({ ...prev, totalXp: prev.totalXp + result.xp_earned }));
        // XP se muestra ya mismo (feedback instantáneo), pero isSubmitting sigue en
        // true hasta que loadProgress() también termine -- si no, "Siguiente nivel"
        // queda clicable con el desbloqueo del próximo nivel todavía desactualizado
        // (carrera real, encontrada por un estudiante haciendo clic rápido).
        setSession((prev) => ({ ...prev, xpEarned: result.xp_earned }));
        const newRegions = await loadProgress();
        if (newRegions) {
          const newlyUnlockedIds = detectNewlyUnlocked(previouslyUnlocked, newRegions);
          if (newlyUnlockedIds.length > 0) {
            // No se muestra todavía: el GameOverModal de victoria sigue abierto encima.
            // useUnlockCelebrations las muestra, una por una y en orden,
            // cuando el jugador está en el mapa (sin importar por qué ruta llegó).
            enqueueUnlock(newlyUnlockedIds, completedRegionNameSnapshot);
          }
        }
        setSession((prev) => ({ ...prev, isSubmitting: false }));
      } catch (err) {
        setSession((prev) => ({
          ...prev,
          isSubmitting: false,
          submitError: err instanceof Error ? err.message : 'No pudimos guardar tu resultado. Revisa tu conexión.',
        }));
      }
    },
    [currentRegionId, currentGameModeId, currentRegion.name, regionsProgress, loadProgress, enqueueUnlock],
  );

  // Answer handler
  const handleSelectOption = useCallback(
    (option: number | null) => {
      if (session.isAnswered || session.gameOver || session.gameWon || isPaused || tutorialGameMode) return;

      const currentQ = session.questions[session.activeQuestionIndex];
      if (!currentQ) return;

      const correct = option !== null && option === currentQ.correct;
      const submittedAnswer = option ?? TIMEOUT_SENTINEL_ANSWER;

      let newHeroHp = session.heroHp;
      let newEnemyHp = session.enemyHp;
      let newBridge = session.bridgeBuiltSegments;
      let newClues = session.cluesFound;
      let newRaceProgress = session.raceProgress;
      let newShopCartTotal = session.shopCartTotal;

      if (correct) {
        if (currentGameModeId === 'race') newRaceProgress = Math.min(100, (session.raceProgress || 0) + 20);
        else if (currentGameModeId === 'battle') newEnemyHp = Math.max(0, session.enemyHp - 25);
        else if (currentGameModeId === 'shop') newShopCartTotal = (session.shopCartTotal || 0) + 1;
        else if (currentGameModeId === 'bridge')
          newBridge = Math.min(session.totalQuestions, session.bridgeBuiltSegments + 1);
        else if (currentGameModeId === 'detective') newClues = Math.min(5, session.cluesFound + 1);
      } else {
        if (currentGameModeId === 'race') newRaceProgress = Math.max(0, (session.raceProgress || 0) - 14);
        else if (currentGameModeId === 'battle') newHeroHp = Math.max(0, session.heroHp - 20);
      }

      const updatedAnswers = [...session.answers, { question_id: currentQ.id, answer: submittedAnswer }];

      setStats((prev) => {
        const newCombo = correct ? prev.combo + 1 : 0;
        const highestCombo = Math.max(prev.highestCombo, newCombo);
        const newLives = correct ? prev.lives : Math.max(0, prev.lives - 1);
        const comboBonus = Math.min(newCombo, 4) * 5;
        const ptsGained = correct ? 20 + comboBonus : 0;
        return {
          ...prev,
          score: prev.score + ptsGained,
          lives: newLives,
          combo: newCombo,
          highestCombo,
        };
      });

      if (correct) {
        playSfx(stats.combo >= 2 ? 'combo' : 'correct');
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
        answers: updatedAnswers,
      }));

      setTimeout(() => {
        setSession((prev) => {
          const nextIndex = prev.activeQuestionIndex + 1;
          const isOutLives = !correct && stats.lives - 1 <= 0;
          const isFinished = nextIndex >= prev.totalQuestions;

          if (isOutLives) {
            playSfx('gameover');
            void finishRound(updatedAnswers);
            return { ...prev, gameOver: true, isTimerActive: false };
          }

          if (isFinished) {
            playSfx('victory');
            void finishRound(updatedAnswers);
            return { ...prev, gameWon: true, isTimerActive: false };
          }

          return {
            ...prev,
            activeQuestionIndex: nextIndex,
            isAnswered: false,
            selectedOption: null,
            isCorrect: null,
            timeLeft: prev.maxTime,
            isTimerActive: true,
            feedbackText: '',
          };
        });
      }, 1400);
    },
    [session, currentGameModeId, stats.combo, stats.lives, finishRound, isPaused, tutorialGameMode],
  );

  // Timer Tick Effect
  useEffect(() => {
    if (
      viewMode !== 'game' ||
      !session.isTimerActive ||
      session.isAnswered ||
      session.gameOver ||
      session.gameWon ||
      isPaused ||
      tutorialGameMode
    ) {
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
  }, [viewMode, session.isTimerActive, session.isAnswered, session.gameOver, session.gameWon, isPaused, tutorialGameMode, handleSelectOption]);

  // Keyboard Shortcuts (1, 2, 3 to answer, M for map)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'm' || e.key === 'M') && !isPaused) {
        setViewMode((v) => (v === 'map' ? 'game' : 'map'));
      } else if (e.key === 's' || e.key === 'S') {
        setIsMuted(toggleAudioMute());
      } else if (e.key === 'v' || e.key === 'V') {
        const btn = document.getElementById('engine-toggle-btn');
        if (btn) btn.click();
      } else if (['1', '2', '3'].includes(e.key) && viewMode === 'game' && !session.isAnswered && !tutorialGameMode && !isPaused) {
        const idx = parseInt(e.key) - 1;
        const q = session.questions[session.activeQuestionIndex];
        if (q && q.options[idx] !== undefined) {
          handleSelectOption(q.options[idx]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, session, handleSelectOption, tutorialGameMode, isPaused]);

  const activeQuestion = session.questions[session.activeQuestionIndex] || null;

  const currentLevelInfo: LevelDisplayInfo = {
    icon: currentGameMode.icon,
    name: `${currentRegion.name} · ${currentGameMode.name}`,
    shortName: currentGameMode.name,
    subtitle: `Nivel ${currentGameMode.sortOrder} de 5 · ${currentRegion.shortName}`,
  };

  // Vuelve al mapa. La celebración de una región recién desbloqueada NO se dispara
  // aquí: la muestra el efecto "celebraciones pendientes", que cubre también la tecla
  // M, los botones de vista y el menú de pausa.
  const goToMap = useCallback(() => {
    setViewMode('map');
    setSession((s) => ({ ...s, gameOver: false, gameWon: false }));
  }, []);

  // Siguiente nivel dentro de la misma región (para el botón del modal de victoria)
  const handleNextLevel = () => {
    const region = regionsProgress.find((r) => r.regionId === currentRegionId);
    const next = region?.levels.find((l) => l.sortOrder === currentGameMode.sortOrder + 1);
    if (next && next.unlocked) {
      initLevelSession(currentRegionId, next.gameModeId);
    } else {
      goToMap();
    }
  };

  const handleDismissUnlock = useCallback(() => {
    dismissUnlock();
  }, [dismissUnlock]);

  // El modal de victoria espera un momento: aparece casi al instante con fondo oscuro y
  // tapaba la animación 3D (corredor cruzando la meta, bandera, puertas) antes de que
  // terminara. La derrota sigue mostrándose de inmediato.
  const showWinModal = useDelayedFlag(session.gameWon, WIN_MODAL_DELAY_MS);

  const handleDismissTutorial = useCallback(() => {
    if (!tutorialGameMode) return;
    markTutorialSeen(tutorialGameMode);
    setTutorialGameMode(null);
    setSession((prev) => ({ ...prev, isTimerActive: true }));
  }, [tutorialGameMode]);

  if (progressLoading) {
    return (
      <div className="min-h-screen bg-[#142138] text-slate-100 flex items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
        <p className="text-sm font-semibold">Cargando tu progreso...</p>
      </div>
    );
  }

  if (progressError) {
    return (
      <div className="min-h-screen bg-[#142138] text-slate-100 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-rose-400" />
        <p className="text-sm font-semibold">No pudimos cargar tus datos.</p>
        <p className="text-xs text-slate-400">{progressError}</p>
        <button
          onClick={() => void loadProgress()}
          className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-sm"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#142138] text-slate-100 flex flex-col items-center justify-start p-3 sm:p-5 md:p-6 font-['Nunito_Sans',sans-serif]">
      <main className="w-full max-w-4xl flex flex-col gap-4">
        {playerName && (
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-sm font-bold text-slate-200 truncate">
              👋 Hola, <span className="text-emerald-300">{playerName}</span>
              {courseName && <span className="text-slate-400 font-semibold"> · {courseName}</span>}
            </p>
            {onExit && (
              <button
                onClick={onExit}
                className="min-h-10 px-3 rounded-xl text-sm font-bold text-slate-300 bg-slate-800/70 hover:bg-slate-700 border border-slate-700 inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>Cambiar de estudiante</span>
              </button>
            )}
          </div>
        )}

        <GameHUD
          currentLevel={currentLevelInfo}
          viewMode={viewMode}
          questionIndex={session.activeQuestionIndex}
          totalQuestions={session.totalQuestions}
          score={stats.totalXp}
          lives={stats.lives}
          maxLives={stats.maxLives}
          combo={stats.combo}
          isMuted={isMuted}
          onToggleSound={() => setIsMuted(toggleAudioMute())}
          onOpenMap={() => setViewMode((v) => (v === 'map' ? 'game' : 'map'))}
          onResetGame={() => initLevelSession(currentRegionId, currentGameModeId)}
          onPause={
            viewMode === 'game' &&
            !levelLoading &&
            !levelError &&
            !session.gameOver &&
            !session.gameWon &&
            !tutorialGameMode
              ? () => setIsPaused(true)
              : undefined
          }
        />

        <section className="relative w-full">
          <WorldViewport
            viewMode={viewMode}
            currentRegionId={currentRegionId}
            gameMode={currentGameModeId}
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
            gameWon={session.gameWon}
            gameOver={session.gameOver}
            activeQuestion={activeQuestion}
            onSelectRegion={handleSelectRegion}
            onToggleViewMode={() => setViewMode((v) => (v === 'map' ? 'game' : 'map'))}
            unlockingRegionId={unlockingRegionId}
            previousRegionName={completedRegionName}
            onDismissUnlock={handleDismissUnlock}
          />
        </section>

        {viewMode === 'game' ? (
          levelLoading ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center text-slate-300 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
              Cargando preguntas del nivel...
            </div>
          ) : levelError ? (
            <div className="bg-slate-900/90 border border-rose-500/40 rounded-2xl p-6 text-center text-rose-200">
              <p className="font-bold mb-2">{levelError}</p>
              <button
                onClick={() => initLevelSession(currentRegionId, currentGameModeId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-sm text-white"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <QuestionPanel
              question={activeQuestion}
              timeLeft={session.timeLeft}
              maxTime={session.maxTime}
              isAnswered={session.isAnswered}
              selectedOption={session.selectedOption}
              isCorrect={session.isCorrect}
              combo={stats.combo}
              feedbackText={session.feedbackText}
              onSelectOption={(opt) => handleSelectOption(typeof opt === 'number' ? opt : Number(opt))}
              gameMode={currentGameModeId}
            />
          )
        ) : (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-center backdrop-blur-md">
            <h3 className="text-xl font-extrabold font-['Baloo_2'] text-white flex items-center justify-center gap-2">
              <Compass className="w-5 h-5 text-amber-400" />
              <span>Explorador del Archipiélago Matemático 3D</span>
            </h3>
            <p className="text-sm text-slate-300 max-w-lg mx-auto mt-2 leading-relaxed">
              Interactúa con el modelo 3D arriba arrastrando con el ratón o el dedo para rotar la cámara.
              Haz clic en cualquier isla para viajar a esa región, o elige un nivel específico abajo.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => {
                  // Antes solo cambiaba viewMode a 'game' sin pedir las
                  // preguntas: si el estudiante entraba nuevo a la app y
                  // tocaba este botón antes de haber cargado un nivel por
                  // otra vía (clic en isla / tira de niveles), `session`
                  // seguía vacío y no aparecía ninguna pregunta. Ahora
                  // siempre carga (o recarga) el nivel real al pulsar.
                  playSfx('click');
                  void initLevelSession(currentRegionId, currentGameModeId);
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-sm text-white flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
              >
                <Play className="w-4 h-4" />
                <span>Continuar jugando: {currentLevelInfo.name}</span>
              </button>
            </div>
          </div>
        )}

        <RegionLevelStrip
          regions={REGIONS}
          progress={regionsProgress}
          totalXp={totalXp}
          currentRegionId={currentRegionId}
          currentGameModeId={currentGameModeId}
          onSelectLevel={handleSelectLevel}
        />

        <footer className="text-center text-xs text-slate-500 py-3 flex flex-wrap items-center justify-center gap-3 border-t border-slate-800/60">
          <span>🎮 MathQuest 5 · Para estudiantes de tercer grado</span>
          <span>·</span>
          <span>⌨️ Atajos: Teclas [1, 2, 3] para responder · [M] Mapa 3D · [S] Sonido</span>
        </footer>
      </main>

      <GameOverModal
        isOpen={session.gameOver || showWinModal}
        isWon={session.gameWon}
        score={stats.score}
        xpGained={session.xpEarned ?? 0}
        submitState={session.isSubmitting ? 'submitting' : session.submitError ? 'error' : 'done'}
        submitErrorMessage={session.submitError}
        correctCount={session.answers.filter((a) => session.questions.find((q) => q.id === a.question_id)?.correct === a.answer).length}
        totalCount={session.totalQuestions}
        currentLevel={currentLevelInfo}
        onReplay={() => initLevelSession(currentRegionId, currentGameModeId)}
        onGoToMap={goToMap}
        onNextLevel={session.gameWon ? handleNextLevel : undefined}
      />

      <GameModeTutorial gameMode={tutorialGameMode} onDismiss={handleDismissTutorial} />

      <PauseModal
        isOpen={isPaused}
        onResume={() => setIsPaused(false)}
        onGoToMap={() => {
          setIsPaused(false);
          setViewMode('map');
        }}
      />
    </div>
  );
}
