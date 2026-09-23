export type GameMode = 'race' | 'battle' | 'shop' | 'bridge' | 'detective';
export type Operation = 'add' | 'sub' | 'mul' | 'div';

/** Metadatos visuales de una región (una por operación). Sin lógica de juego. */
export interface RegionDefinition {
  id: string;
  name: string;
  shortName: string;
  operation: Operation;
  themeColor: string;
  accentColor: string;
  bgGradient: string;
  icon: string;
  competency: string;
  description: string;
  islandPosition: [number, number, number]; // [x, y, z] en el mapa 3D
}

/** Metadatos visuales de un modo de juego (uno de los 5 niveles, igual en las 4 regiones). */
export interface GameModeInfo {
  id: GameMode;
  name: string;
  subtitle: string;
  icon: string;
  sortOrder: number; // 1 Carrera · 2 Batalla · 3 Puente · 4 Tienda · 5 Detective (ver ADR-006)
}

/** Fila de la tabla `game_modes` en Supabase (configuración real del nivel). */
export interface GameModeConfig {
  id: GameMode;
  questionKinds: Array<'direct' | 'missing_first' | 'missing_second'>;
  questionsPerRound: number;
  secondsPerQuestion: number;
  lives: number;
  difficultyMin: number;
  difficultyMax: number;
  sortOrder: number;
}

/** Pregunta lista para jugarse (ya con las opciones mezcladas). */
export interface MathQuestion {
  id: number;
  text: string;
  category: string;
  difficulty: number;
  options: number[];
  correct: number;
  explanation: string;
}

/** Estado de un nivel (una combinación región + modo) para el mapa/tira de niveles. */
export interface LevelProgress {
  gameModeId: GameMode;
  sortOrder: number;
  unlocked: boolean;
  bestStars: number;
  roundsPlayed: number;
}

/** Estado de una región completa: si está desbloqueada y el progreso de sus 5 niveles. */
export interface RegionProgress {
  regionId: string;
  sortOrder: number;
  requiredXp: number;
  unlocked: boolean;
  levels: LevelProgress[];
}

/** Info mínima para pintar el HUD / modal de fin de partida sobre el nivel activo. */
export interface LevelDisplayInfo {
  icon: string;
  name: string; // "Bosque de la Suma · Carrera Matemática"
  shortName: string; // "Carrera"
  subtitle: string; // "Nivel 1 de 5 · Bosque de la Suma"
}

export interface PlayerStats {
  totalXp: number;
  score: number;
  lives: number;
  maxLives: number;
  combo: number;
  highestCombo: number;
}

/** Una respuesta enviada por el estudiante, lista para submit_round(). */
export interface RoundAnswer {
  question_id: number;
  answer: number;
}

export interface GameSessionState {
  regionId: string;
  gameModeId: GameMode;
  activeQuestionIndex: number;
  totalQuestions: number;
  questions: MathQuestion[];
  answers: RoundAnswer[];
  isAnswered: boolean;
  selectedOption: number | null;
  isCorrect: boolean | null;
  timeLeft: number;
  maxTime: number;
  isTimerActive: boolean;
  feedbackText: string;
  gameOver: boolean;
  gameWon: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  xpEarned: number | null; // llega de submit_round(); null mientras no se conoce
  // Sub-estados específicos de cada mecánica (se reutilizan igual en las 4 regiones)
  raceProgress: number; // 0 a 100%
  heroHp: number; // 0 a 100
  enemyHp: number; // 0 a 100
  bridgeBuiltSegments: number;
  shopCartTotal: number;
  cluesFound: number;
}
